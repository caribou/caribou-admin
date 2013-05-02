(ns caribou.admin.controllers.content.models
  (:require [clojure
             [string :as string]
             [set :as set]
             [pprint :as pprint]
             [walk :as walk]]
            [clj-time.core :as timecore]
            [cheshire.core :refer [generate-string]]
            [caribou
             [model :as model]
             [query :as query]
             [util :as util]
             [logger :as log]
             [asset :as asset]
             [config :as config]
             [index :as index]
             [permissions :as permissions]]
            [caribou.app
             [pages :as pages]
             [template :as template]
             [handler :as handler]
             [controller :as controller]]
            [caribou.admin.helpers :as helpers]
            [caribou.field.link :as link]))

(defn itemize-by
  [k m]
  (into {} (map (fn [[k [v]]] [k v]) (group-by k m))))

(defn inflate-request
  [{{local-code :locale} :params
    {{{role :role_id} :user} :admin} :session
    :as request}]
  (let [locale (when-not ((some-fn nil? empty? #{"global"}) locale-code)
                 (model/pick :locale {:where {:code locale-code}}))
        {permissions
         :permissions} (model/pick :role {:where {:id role}
                                          :include {:permissions {}}})
        permissions (itemize-by :model_id permissions)]
    (assoc request
      :locale locale
      :permissions permissions)))

(defn order-get-in [thing path]
  (or (helpers/get-in-helper thing path) 0))

(defn order-info
  ([model]
    {:model model :association "position" :position-slug "position"})
  ([model association umbrella]
    {:model model
     :umbrella (:id umbrella)
     :association (or (get-in association [:slug])
                      (get-in association [:row :slug]))
     :position-slug (str (:slug association) "_position")}))

(defn part-title
  [field]
  (let [target (model/pick :model {:where {:id (:target_id field)}
                                   :include {:fields {}}})]
    (-> target :fields first :slug)))

(defn field-path
  [field]
  (if (= (:type field) "part")
    (str (:slug field) "." (part-title field))
    (:slug field)))

(defn build-includes
  "given a model, finds associated models, excluding join models,
   and returns them in a map suitable for use in an :include clause
   of gather."
  [model]
  (let [fields (if (map? (:fields model))
                 (map :row (vals (:fields model)))
                 (:fields model))]
    (into {}
      (map #(vector (keyword (:slug %)) {})
        (filter (fn [a] (and (some #(= (:type a) %) ["collection", "part", "link"])
                             (not (:join_model (@model/models (:target_id a)))))) fields)))))

(defn human-friendly-fields
  "returns the set of fields that a human can read - is a bit hacky"
  [model]
  (let [fields (:fields model)
        stripped  (remove #(or (.endsWith (:slug %) "_id")
                               (.endsWith (:slug %) "_position")
                               (.endsWith (:slug %) "_at")
                               (= (:type %) "collection")
                               (= (:type %) "link")
                               (= (:type %) "boolean")) fields)
        filled (map #(assoc % :friendly-path (field-path %)) stripped)]
    (println (map :friendly-path filled))
    filled))

(def all-helpers
  {:order-get-in order-get-in})

(defn render
  ([content-type params]
    (controller/render content-type params))
  ([params]
    (controller/render (merge all-helpers params))))

(defn json-response
  [data]
  {:status 200
   :body (generate-string data)
   :headers {"Content-Type" "application/json"}})

(defn part
  [f col]
  (let [groups (group-by f col)
        yes (get groups true)
        no (get groups false)]
    [yes no]))

(defn index
  [request]
  (let [models (model/gather :model {:order {:id :asc}})
        [locked unlocked] (part :locked models)]
    (render (merge request {:locked locked :unlocked unlocked}))))

(defn new
  [request]
  (let [new-model-name (-> request :params :model-name string/capitalize)
        ; validate here
        new-model (model/create :model {:name new-model-name})]
    (controller/redirect (pages/route-for
                          :admin.edit_model
                          (dissoc (merge {:slug (:slug new-model)}
                                         (:params request))
                                  :model-name)))))

(defn view
  [request]
  (let [model (model/pick :model {:where {:slug (-> request :params :slug)}
                                  :include {:fields {}}
                                  :order {:position :asc}})
        models (seq (sort-by :name (-> @model/models vals set)))]
    (render (merge request {:model model :models models}))))

(defn keyword-results
  "This inefficiently inflates search results into
  real content directly from the DB, one-by-one"
  [kw slug opts]
  (let [m (@model/models (keyword slug))
        ;; TODO - remove this hardcoded limit and make it work with pagination
        raw (index/search m kw (assoc opts :limit 200))
        _ (println raw)
        includes (build-includes m)
        inflated (map (fn [r] (model/pick slug {:where {:id (:id r)}
                                                :include includes}))
                      raw)]
    inflated))

(defn view-results
  [request]
  (let [request (inflate-request request)
        {{locale-code :code :as locale} :locale
         {model-slug :slug
          ordering :order
          keywordize :keyword
          limit :limit
          offset :offset
          size :size
          :as params} :params
         {page-slug :slug :as page} :page} request
        model (model/pick :model {:where {:slug model-slug}
                                  :include {:fields {}}})
        includes (build-includes model)
        order-default (or ordering "position")
        order {:slug (first (clojure.string/split order-default #" "))
               :direction (if (.endsWith order-default "desc") "desc" "asc")}
        kw-results (when-not (empty? keywordize)
                     (keyword-results keywordize model-slug
                                      {:locale locale-code}))
        spec {:limit limit
              :offset offset
              :include includes
              :locale locale-code
              :order (model/process-order order-default)}
        results (or kw-results (model/gather model-slug spec))
        friendly-fields (human-friendly-fields model)
        order-info (order-info model)
        pager (helpers/add-pagination
               results {:page-size (or size 20)
                        :page-slug page-slug
                        :current-page page})]
    (if locale
      (log/debug (str "Locale is " locale-code))
      (log/debug "Locale is global"))
    (render (assoc request
              :results results
              :model model
              :fields friendly-fields
              :allows-sorting true
              :order order
              :order-info order-info
              :pager pager))))

(defn new-field
  [request]
  (let [params (-> request :params)
        field-name (:field-name params)
        field-type (:field-type params)
        searchable (= (:searchable params) "yes")
        reciprocal-name (:reciprocal-name params)
        target-id (:target-id params)
        ;; extra bits here, validate, etc
        model (model/pick :model {:where {:slug (-> request :params :slug)} :include {:fields {}}})
        new-field (if (not (nil? target-id))
                    {:name (string/capitalize field-name)
                     :type field-type
                     :searchable searchable
                     :target_id target-id
                     :reciprocal_name (string/capitalize reciprocal-name)}
                    {:name (string/capitalize field-name)
                     :searchable searchable
                     :type field-type})
        new-model (model/update :model (:id model) {:fields [ new-field ] })]
      (controller/redirect (pages/route-for :admin.edit_model
                             (dissoc (:params request) :field-name
                                                       :field-type
                                                       :searchable
                                                       :target-id
                                                       :reciprocal-name)))))


(defn edit
  [request]
  (view request))

(defn edit-instance
  [request]
  (let [request (inflate-request request)
        model-slug (-> request :params :slug)
        model (model/pick :model {:where {:slug model-slug} :include {:fields {}}})
        model-fields (:fields model)
        id-param (-> request :params :id)
        ids (if-not (nil? id-param)
              (clojure.string/split (-> request :params :id) #"[,:]")
              [])
        specific? (= 1 (count ids))
        include   (into {}
                    (map #(vector (keyword (:slug %)) {})
                      (filter (fn [a] (some #(= % (:type a)) ["collection", "part", "link"])) (model/db #(:fields model)))))
        instance  (if specific?
                    (model/pick (keyword (:slug model)) {:where {:id (-> request :params :id)} :include include})
                    {})]
    (render (merge {:model model
                    :bulk? (and (> (count ids) 0) (not specific?))
                    :instance-ids (generate-string ids)
                    :instance instance} request))))

(defn edit-instance-post
  [request]
  (let [model-slug (-> request :params :slug)
        edited-instance (dissoc (:params request) :slug)
        updated-instance (model/create model-slug edited-instance)]
    (println updated-instance)
    (controller/redirect (pages/route-for :admin.edit_model_instance {:id (:id updated-instance) :slug model-slug})
      {:cookies {"success-message" {:value (str "You successfully updated this " model-slug)}}})))

(defn create-instance
  [request]
  (edit-instance request))

#_(defn editor-for
    ;; given a model slug, generates an editor for that model
    [request]
    (let [request (inflate-request request)
          model (model/pick :model {:where {:slug (-> request :params :model)} :include {:fields {}}})
          template (template/find-template (util/pathify ["content" "models" "instance" "_edit.html"]))]
      (render (merge request {:template template :model model}))))

(defn find-content
  [params]
  (let [model (model/pick :model {:where {:slug (:model params)} :include {:fields {}}})
        include (build-includes model)
        where (if (:where params)
                (model/process-where (:where params))
                (if (empty? (:id params)) {} {:id (:id params)}))
        order (if (:order params) (model/process-order (:order params)) {})
        locale-code (if (or (nil? (:locale-code params)) (empty? (:locale-code params)))
                      nil
                      (:locale-code params))
        raw-content (model/gather (:slug model) {:where where
                                                 :include include
                                                 :limit (:limit params)
                                                 :offset (:offset params)
                                                 :results :clean
                                                 :locale locale-code})
        content (map #(if (= (:slug model) "asset")
                        (assoc % :path (asset/asset-path %))
                        %) raw-content)]
    content))

(defn find-associated-content
  [params]
  (let [model (@model/models (keyword (:model params)))
        association (get-in model [:fields (keyword (:field params))])
        assoc-name (-> association :row :slug)
        assoc-type (-> association :row :type)
        target (model/pick :model {:where {:id (-> association :row :target_id)} :include {:fields {}}})
        include {(keyword (-> association :row :slug)) (build-includes target)}
        join-include (if (= (-> association :row :type) "link")
                       (assoc include (keyword (str assoc-name "_join")) {})
                       include)
        _ (println join-include)
        where (if (empty? (:id params)) {} {:id (:id params)})
        locale-code (if (or (nil? (:locale-code params)) (empty? (:locale-code params)))
                      nil
                      (:locale-code params))
        raw-content (model/gather (:slug model) {:where where
                                                 :include join-include
                                                 :limit (:limit params)
                                                 :offset (:offset params)
                                                 :results :clean
                                                 :locale (:locale-code params)})
        instance (first raw-content)
        associated-content ((keyword assoc-name) instance)
        content (map #(if (= (:slug model) "asset")
                          (assoc % :path (asset/asset-path %))
                          %) associated-content)]
    {:instance instance :content content}))

(defn editor-associated-content
  "Associated content has to be handled slightly differently because
   different information is required to fetch it."
  [request]
  (let [params (-> request :params)
        model (@model/models (keyword (:model params)))
        association (get-in model [:fields (keyword (:field params))])
        target (model/pick :model {:where {:id (-> association :row :target_id)} :include {:fields {}}})
        template (template/find-template
                   (util/pathify ["content" "models" "instance" (or (:template params) "_collection.html")]))
        stuff (find-associated-content params)
        content (:content stuff)
        instance (:instance stuff)
        pager (helpers/add-pagination content
                {:page-size (or (:size params) 20)  ;; TODO:kd - put default page size into config
                 :current-page (:page params)})
        friendly-fields (human-friendly-fields target)
        order-info (order-info model association instance)
        global? (or (and (contains? params :locale-code) (empty? (:locale-code params))) (nil? (:locale params)))
        response {:template (:body (render (merge request {:template template
                                                           :model target
                                                           :fields friendly-fields
                                                           :order-info order-info
                                                           :pager pager
                                                           :results (:results pager)
                                                           :global? global?
                                                           })))
                  :model target
                  :state (:results pager)}]
    (json-response response)))

(defn editor-content
  [request]
  (let [request (inflate-request request)
        params (-> request :params)
        model (model/pick :model {:where {:slug (:model params)} :include {:fields {}}})
        template (template/find-template
                   (util/pathify ["content" "models" "instance" (or (:template params) "_edit.html")]))
        results (find-content params)
        instance (if-not (empty? (:id params))
                   (first results))
        friendly-fields (human-friendly-fields model)
        global? (or (nil? (:locale request)) (and (contains? params :locale-code) (empty? (:locale-code params))))
        pager (helpers/add-pagination results
                {:page-size (or (:size params) 20)  ; TODO:kd - put default page size into config
                  :current-page (:page params)})]
    (json-response
      {:template (:body (render (merge request {:template template
                                                :model model
                                                :instance instance
                                                :fields friendly-fields
                                                :order-info (order-info model)
                                                :pager pager
                                                :results (:results pager)
                                                :global? global?
                                                })))
       :model model
       :state (if-not (contains? params :id) (:results pager) instance)})))

(defn bulk-editor-content
  [request]
  (let [request (inflate-request request)
        params (:params request)
        model-slug (:model params)
        model (model/pick :model {:where {:slug model-slug} :include {:fields {}}})
        id-list (clojure.string/split (:id params) #"[,:]")
        inflated (remove nil? (map #(model/pick model-slug {:where {:id %}}) id-list))
        all-equal (fn [a b]
                    (if (map? a)
                      (if (= (:id a) (:id b)) a nil)
                      (if (= a b) a nil)))
        merged (apply (partial merge-with all-equal) inflated)
        global? (or (nil? (:locale request)) (and (contains? params :locale-code) (empty? (:locale-code params))))
        template (template/find-template
                   (util/pathify ["content" "models" "instance" (or (:template params) "_edit.html")]))]
    (json-response
      {:template (:body (render (merge request {:template template
                                                :model model
                                                :instance merged
                                                :bulk? true
                                                :ids (:id params)
                                                :fields (human-friendly-fields model)
                                                :order-info (order-info model)
                                                :global? global?
                                                })))
       :model model
       :state merged
       :inflated inflated})))

(defn json-payload
  [request]
  (:data (walk/keywordize-keys (-> request :json-params))))

(defn remove-link
  [request]
  (let [payload (json-payload request)
        model (@model/models (keyword (:model payload)))
        association (get-in model [:fields (keyword (:field payload))])
        deleted (link/remove-link association (:id payload) (:target-id payload))]
    (json-response deleted)))

; updates multiple models.  needs some validation/idiot-proofing.
(defn update-all
  [request]
  (let [payload (json-payload request)
        _ (log/debug payload)
        updated (map (fn [x]
                      (vector
                       (:model x)
                       (model/create (keyword (:model x)) (:fields x) (or (:opts x) {}))))
                        payload)
        results (map second updated)]
    (when-not (empty? (set/intersection #{"model" "field"} (set (map :model payload))))
      (log/debug "Reloading model, clearing query cache!")
      (query/clear-queries)
      (model/init))
    (when-not (empty? (set/intersection #{"page"} (set (map :model payload))))
      (println "RESETTING HANDLER!!")
      (handler/reset-handler))
    (json-response results)))

(defn reorder-all
  [request]
  (let [payload (json-payload request)
        association-slug (:association payload)
        id (:id payload)
        items (doall (map (fn [x] {:id (Integer/parseInt (:id x)) :position (:position x)}) (:items payload)))
        results (if (and association-slug id)
                  (do
                    (println (str "reordering " (:association payload) " of " (:model payload) " " (:id payload)
                     " to " items))
                    (model/order (:model payload)
                                 (:id payload)
                                 (:association payload)
                                 items))
                  (model/order (:model payload) items))]
    (json-response results)))

; this is too drastic and should probably have some sanity checking.
(defn delete-all
  [request]
  (let [payload (json-payload request)
        results (map #(model/destroy (keyword (:model %)) (:id %)) payload)]
    (query/clear-queries)
    (model/init)
    (json-response results)))

(defn find-all
  [request]
  (let [model (or (keyword (-> request :params :model)) :model)
        include (-> request :params :include)]
    (json-response (model/find-all model {:include include}))))

(defn find-one
  [request]
  (let [params (-> request :params)
        slug (or (keyword (:model params)) :model)
        include (:include params)
        where (if (:slug params) {:slug (:slug params)} {:id (:id params)})]
    (json-response (model/pick slug {:where where :include (model/process-include include)}))))

(defn to-route
  [request]
  (controller/redirect (pages/route-for (-> request :params :page keyword) (dissoc (:params request) :action :page))))

(defn reindex
  [request]
  (let [model (@model/models (keyword (-> request :params :slug)))]
    (println (index/update-all model))
    (controller/redirect (pages/route-for :admin.models (dissoc (:params request) :action :slug)))))

(defn slugify-filename
  [s]
  (.toLowerCase
   (clojure.string/replace
    (clojure.string/join "-" (re-seq #"[a-zA-Z0-9.]+" s))
    #"^[0-9]" "-")))

(defn upload-asset
  [request]
  (let [params (:params request)
        upload (get params "upload")
        slug (slugify-filename (:filename upload))
        asset (model/create
               :asset
               {:filename slug
                :content_type (:content-type upload)
                :size (:size upload)})
        dir (asset/asset-dir asset)
        location (asset/asset-location asset)
        path (asset/asset-path asset)]
    (if (:asset-bucket @config/app)
      (asset/upload-to-s3 location (-> params :upload :tempfile))
      (asset/persist-asset-on-disk dir path (:tempfile upload)))
    (json-response {:state (assoc asset :path path)})))

(defonce rq (atom {}))

(defonce pm (atom {}))

(defn api
  [{{action :action} :params :as request}]
  (swap! pm assoc (keyword action) (select-keys request [:params]))
  (let [request (inflate-request request)]
    (reset! rq request)
    (condp = action
      ;; "editor-for" (editor-for request)
      "editor-content" (editor-content request)
      "editor-associated-content" (editor-associated-content request)
      "update-all" (update-all request)
      "reorder-all" (reorder-all request)
      "find-all" (find-all request)
      "find-one" (find-one request)
      "delete-all" (delete-all request)
      "to-route" (to-route request)
      "upload-asset" (upload-asset request)
      "remove-link" (remove-link request)
      "reindex" (reindex request)
      "bulk-editor-content" (bulk-editor-content request)
      {:status 404 :body "Awwwwww snap!"})))
