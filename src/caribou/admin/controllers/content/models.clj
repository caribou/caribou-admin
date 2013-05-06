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
  (->> m
       (group-by k)
       (map (fn [[k [v]]] [k v]))
       (into {})))

(defn all-permissions
 [role-id]
 (let [{permissions
        :permissions} (model/pick :role {:where {:id role-id}
                                         :include {:permissions {}}})]
   permissions))

(defn inflate-request
  [{{locale-code :locale} :params
    {{{role :role_id} :user} :admin} :session
    :as request}]
  (let [locale (when-not ((some-fn nil? empty? #{"global"}) locale-code)
                 (model/pick :locale {:where {:code locale-code}}))
        permissions (all-permissions role)
        permissions (itemize-by :model_id permissions)]
    (assoc request
      :locale locale
      :permissions permissions)))

(defn order-get-in
  [thing path]
  (or (helpers/get-in-helper thing path)
      0))

(defn order-info
  ([model]
    {:model model :association "position" :position-slug "position"})
  ([model
    {{row-slug :slug} :row
     association-slug :slug}
    {umbrella-id :id}]
    {:model model
     :umbrella umbrella-id
     :association (or association-slug row-slug)
     :position-slug (str association-slug "_position")}))

(defn part-title
  [field]
  (let [target (model/pick :model {:where {:id (:target_id field)}
                                   :include {:fields {}}})]
    (-> target :fields first :slug)))

(defn field-path
  [{type :type slug :slug :as field}]
  (if (= type "part")
    (str slug "." (part-title field))
    field))

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
           (filter (fn [a]
                     (and ((comp #{"collection", "part", "link"} :type) a)
                          (-> a :targe_id (@model/models) :join_model not)))
                   fields)))))

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
          page :page
          :as params} :params
         {page-slug :slug} :page} request
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
        model (model/pick :model {:where {:slug (-> request :params :slug)}
                                  :include {:fields {}}})
        new-field (if (not (nil? target-id))
                    {:name (string/capitalize field-name)
                     :type field-type
                     :searchable searchable
                     :target_id target-id
                     :reciprocal_name (string/capitalize reciprocal-name)}
                    {:name (string/capitalize field-name)
                     :searchable searchable
                     :type field-type})
        new-model (model/update :model (:id model) {:fields [new-field]})]
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
        model (model/pick :model {:where {:slug model-slug}
                                  :include {:fields {}}})
        model-fields (:fields model)
        id-param (-> request :params :id)
        ids (if-not (nil? id-param)
              (clojure.string/split (-> request :params :id) #"[,:]")
              [])
        specific? (= 1 (count ids))
        include   (into {}
                    (map #(vector (keyword (:slug %)) {})
                         (filter (comp #{"collection" "part" "link"} :type)
                                 (model/db #(:fields model)))))
        instance  (if specific?
                    (model/pick (keyword (:slug model))
                                {:where {:id (-> request :params :id)}
                                 :include include})
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
    (controller/redirect
     (pages/route-for :admin.edit_model_instance
                      {:id (:id updated-instance) :slug model-slug})
     {:cookies {"success-message"
                {:value (str "You successfully updated this " model-slug)}}})))

(defn create-instance
  [request]
  (edit-instance request))

#_(defn editor-for
    ;; given a model slug, generates an editor for that model
    [request]
    (let [request (inflate-request request)
          model (model/pick :model {:where {:slug (-> request :params :model)}
                                    :include {:fields {}}})
          template (template/find-template
                    (util/pathify
                     ["content" "models" "instance" "_edit.html"]))]
      (render (merge request {:template template :model model}))))

(defn find-associated-content
  [{model :model
    field :field
    locale-code :locale-code
    limit :limit
    offset :offset
    id :id}]
  (let [{slug :slug :as model} (@model/models (keyword model))
        {{assoc-name :slug
          assoc-type :type
          target-id :target_id} :row
          :as association} (get-in model [:fields (keyword field)])
        target (model/pick :model {:where {:id target-id}
                                   :include {:fields {}}})
        include {(keyword assoc-name) (build-includes target)}
        join-include (if (= assoc-type "link")
                       (assoc include (keyword (str assoc-name "_join")) {})
                       include)
        where (if-not id {} {:id id})
        locale-code (if (empty? locale-code)
                      nil
                      locale-code)
        instance (model/pick slug {:where where
                                   :include join-include
                                   :limit limit
                                   :offset offset
                                   :results :clean
                                   :locale locale-code})
        associated-content ((keyword assoc-name) instance)
        content (if-not (= slug "asset")
                  associated-content
                  (map #(assoc % :path (asset/asset-path %))
                       associated-content))]
    {:instance instance :content content}))

(defn has-perms
  [model permissions actions role-id]
  (if (or (not model)
          (not permissions)
          (not role-id))
    false
    (let [model (cond (string? model) (-> model keyword (@model/models) :id)
                      (keyword? model) (-> @model/models model :id)
                      (number? model) model)
          required-mask (apply permissions/mask actions)
          permission (first (filter (comp #{model} :model_id) permissions))
          mask (or (:mask permission)
                   (:mask (model/pick :permission {:where {:role_id role-id
                                                           :model_id  model}}))
                   (:default_mask (model/pick :role {:where {:id role-id}}))
                   0)]
      (=  required-mask (bit-and required-mask mask)))))

(defn editor-associated-content
  "Associated content has to be handled slightly differently because
   different information is required to fetch it."
  [{{slug :model
     field :field
     template :template
     page-size :size
     page :page
     locale-code :locale-code
     :as params} :params
     locale :locale
     permissions :permissions
     {{{role-id :role_id} :user} :admin} :session
     :as request}]
  (let [model (@model/models (keyword slug))
        _ (assert (has-perms (:id model) permissions [:read :write] role-id))
        {{target-id :target_id } :row
         :as association} (get-in model [:fields (keyword field)])
        target (model/pick :model {:where {:id target-id}
                                   :include {:fields {}}})
        _ (assert (has-perms (:id target) permissions [:read :write] role-id))
        template-name (or template "_collection.html")
        template (template/find-template
                  (util/pathify ["content" "models" "instance" template-name]))
        {content :content instance :instance} (find-associated-content params)
        page-size (or page-size 20)
        ;; TODO:kd - put default page size into config
        {results :results
         :as pager} (helpers/add-pagination content
                                            {:page-size page-size
                                             :current-page page})
        friendly-fields (human-friendly-fields target)
        order-info (order-info model association instance)
        global? (or (and (contains? params :locale-code)
                         (empty? locale-code))
                    (nil? locale))
        request (assoc request
                  :template template
                  :model target
                  :fields friendly-fields
                  :order-info order-info
                  :pager pager
                  :results results
                  :global? global?)
        response {:template (-> request render :body)
                  :model target
                  :state results}]
    (json-response response)))

(defn only-include
  [include-set raw]
  (if-not (map? raw)
    raw
    (->> raw
         (map (fn [[k v]]
                (when (include-set k)
                  [k (only-include include-set v)])))
         (filter identity)
         (into {}))))

(defn get-readable-models
  [permissions]
  (->> permissions
       (filter :mask)
       (filter (comp permissions/check-read :mask))
       (map #(-> % :model_id (@model/models) :slug))
       set))

(defn find-content
  [model
   {where :where
    id :id
    order :order
    locale-code :locale-code
    limit :limit
    offset :offset}
   permissions]
  (let [include (build-includes model)
        include-set (get-readable-models permissions)
        include (only-include include-set include)
        where (cond
                where (model/process-where where)
                id {:id id}
                :default {})
        order (if order (model/process-order order) {})
        locale-code (if (empty? locale-code)
                      nil
                      locale-code)
        raw-content (model/gather (:slug model) {:where where
                                                 :include include
                                                 :limit limit
                                                 :offset offset
                                                 :results :clean
                                                 :locale locale-code})
        content (map #(if (= (:slug model) "asset")
                        (assoc % :path (asset/asset-path %))
                        %) raw-content)]
    content))

(defn editor-content
  [{{model :model
     template :template
     target-id :id
     locale-code :locale-code
     size :size
     page :page
     :as params} :params
     {{{role-id :role_id} :user} :admin} :session
     permissions :permissions
     locale :locale
     :as request}]
  (let [model (model/pick :model {:where {:slug model}
                                  :include {:fields {}}})
        _ (assert (has-perms (:id model) permissions [:read :write] role-id))
        template (template/find-template
                  (util/pathify ["content" "models" "instance"
                                 (or template "_edit.html")]))
        results (find-content model params permissions)
        instance (when target-id
                   (first results))
        friendly-fields (human-friendly-fields model)
        global? (or (not locale)
                    (and (contains? params :locale-code)
                         (empty? locale-code)))
        size (or size 20)
        {results :results
         :as pager} (helpers/add-pagination
                     results
                     ;; TODO:kd - put default page size into config
                     {:page-size size :current-page page})
        request (assoc request
                  :template template
                  :model model
                  :instance instance
                  :fields friendly-fields
                  :order-info (order-info model)
                  :pager pager
                  :results results
                  :global? global?)
        state (if-not (contains? params :id)
                results
                instance)]
    (json-response
     {:template (-> request render :body)
      :model model
      :state state})))

(defn bulk-editor-content
  [{{model-slug :model
     locale-code :locale-code
     id :id
     template :template
     :as params} :params
    locale :locale
    :as request}]
  (let [model (model/pick :model {:where {:slug model-slug}
                                  :include {:fields {}}})
        id (or id "")
        id-list (string/split id #"[,:]")
        inflated (remove nil? (map #(model/pick model-slug {:where {:id %}})
                                   id-list))
        all-equal (fn [a b]
                    (if (map? a)
                      (if (= (:id a) (:id b)) a nil)
                      (if (= a b) a nil)))
        merged (apply (partial merge-with all-equal) inflated)
        global? (or (not locale)
                    (and (contains? params :locale-code)
                         (empty? locale-code)))
        template-file (or template "_edit.html")
        template (template/find-template
                   (util/pathify ["content" "models" "instance" template-file]))
        request (assoc request
                  :template template
                  :model model
                  :instance merged
                  :bulk? true
                  :ids id
                  :fields (human-friendly-fields model)
                  :order-info (order-info model)
                  :global? global?)]
    (json-response
     {:template (-> request render :body)
      :model model
      :state merged
      :inflated inflated})))

(defn json-payload
  [request]
  (:data (walk/keywordize-keys (-> request :json-params))))

(defn remove-link
  [request]
  (let [{field :field
         target-id :target-id
         model :model
         id :id} (json-payload request)
        model (@model/models (keyword model))
        association (get-in model [:fields (keyword field)])
        deleted (link/remove-link association id target-id)]
    (json-response deleted)))

;; updates multiple models.  needs some validation/idiot-proofing.
;; appears to only create models, never update? JS
(defn update-all
  [{permissions :permissions
    {{{role-id :role_id} :user} :admin} :session
    :as request}]
  (let [payload (json-payload request)
        _ (doseq [{name :model} payload]
            (assert (has-perms name permissions [:create] role-id)))
        results (map (fn [{model :model fields :fields opts :opts}]
                       (model/create (keyword model) fields (or opts {})))
                     payload)
        model-set (->> payload (map :model) set)]
    (when-not (->  #{"model" "field"} (set/intersection model-set) empty?)
      (query/clear-queries)
      (model/init))
    #_(when-not (->  #{"page"} (set/intersection model-set) empty?)
        (handler/reset-handler))
    (json-response results)))

(defn reorder-all
  [request]
  (let [{association-slug :association
         id :id
         items :items
         model :model
         :as payload} (json-payload request)
         items (doall (map (fn [{id :id position :position}]
                             {:id (Integer/parseInt id)
                              :position position})
                           items))
        results (if (and association-slug id)
                  (model/order model id  association-slug items)
                  (model/order model items))]
    (json-response results)))

; this is too drastic and should probably have some sanity checking.
(defn delete-all
  [request]
  (let [payload (json-payload request)
        results (map (fn [{id :id
                           model :model}]
                       model/destroy (keyword model) id)
                     payload)]
    (query/clear-queries)
    (model/init)
    (json-response results)))

(defn find-all
  [{{model :model
     include :include} :params}]
  (let [model (or (keyword model) :model)]
    (json-response (model/find-all model {:include include}))))

(defn find-one
  [{{model :model
     include :include
     id :id
     param-slug :slug} :params}]
  (let [slug (or (keyword model) :model)
        where (if param-slug
                {:slug param-slug}
                {:id id})
        include (model/process-include include)]
    (json-response (model/pick slug {:where where :include include}))))

(defn to-route
  [{{page :page :as params} :params}]
  (controller/redirect
   (pages/route-for (keyword page)
                    (dissoc params :action :page))))

(defn reindex
  [{{slug :slug :as params} :params}]
  (let [model (@model/models (keyword slug))]
    (index/update-all model)
    (controller/redirect (pages/route-for :admin.models
                                          (dissoc params :action :slug)))))

(defn slugify-filename
  [s]
  (->> s (re-seq #"[a-zA-z0-9.]+") (string/join "-")
       #((string/replace % #"^[0-9]" "-")) ((memfn toLowerCase)))
  #_(.toLowerCase
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
    (try (condp = action
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
           {:status 404 :body "Awwwwww snap!"})
         (catch java.lang.AssertionError assertion
           {:status 403
            :body "insufficient permissions to perform this action"}))))
