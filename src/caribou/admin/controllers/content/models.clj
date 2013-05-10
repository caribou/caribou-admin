(ns caribou.admin.controllers.content.models
  (:use [cheshire.core :only (generate-string)])
  (:require [caribou.model :as model]
            [caribou.query :as query]
            [caribou.field.link :as link]
            [caribou.app.controller :as controller]
            [clojure.string :as string]
            [clojure.set :as set]
            [clj-time.core :as timecore]
            [clojure.pprint :as pprint]
            [clojure.walk :as walk]
            [caribou.util :as util]
            [caribou.association :as assoc]
            [caribou.logger :as log]
            [caribou.app.pages :as pages]
            [caribou.app.template :as template]
            [caribou.app.handler :as handler]
            [caribou.asset :as asset]
            [caribou.config :as config]
            [caribou.index :as index]
            [caribou.admin.helpers :as helpers]
            [caribou.admin.core :as admin]))

(defn role-id [{{{{role-id :role-id} :user} :admin} :session}] role-id)

(defn all-permissions
 [request]
 (let [{permissions
        :permissions} (model/pick
                       :role
                       {:where {:id (role-id request)}
                        :include {:permissions {}}})]
   permissions))

(defn has-perms
  [model permissions actions role-id]
  (if (or (not model)
          (not permissions)
          (not role-id))
    false
    (let [model (cond (string? model) (-> model keyword (model/models) :id)
                      (keyword? model) (model/models model :id)
                      (number? model) model)
          required-mask (apply permissions/mask actions)
          permission (first (filter (comp #{model} :model-id) permissions))
          mask (or (:mask permission)
                   (:mask (model/pick :permission {:where {:role-id role-id
                                                           :model-id  model}}))
                   (:default-mask (model/pick :role {:where {:id role-id}}))
                   0)]
      (=  required-mask (bit-and required-mask mask)))))

;; (defn flatten-nest [m] (apply set/union (set (keys m)) (map flatten-nest (filter map? (vals m)))))

(defn check-includes
  [model opts [role-id permissions] access]
  (let [model (model/models (keyword model))
        include (set (assoc/span-models-involved model opts []))
        all-included (set/union #{(:id model)} include)]
    (assert (every? #(has-perms (model/models %) permissions access role-id)
                    all-included))
    "sufficient permissions to collect the requested data"))

(defn gather
  [permissions slug & opts]
  (check-includes slug opts permissions [:read])
  (model/gather slug opts))

(def pick (comp first gather))

(defn create
  [permissions slug opts]
  (check-includes slug opts permissions [:create]))

(defn destroy
  [[role-id permissions] slug id]
  (assert (has-perms (model/models slug) permissions [:destroy] role-id)
          "sufficient permissions to destroy the requested item")
  (model/destroy slug id))

(defn itemize-by
  [k m]
  (->> m
       (group-by k)
       (map (fn [[k [v]]] [k v]))
       (into {})))

(defn join [& args] (string/join \newline args))

(defn with-permissions
  [action request f]
  (let [permissions (all-permissions request)]
    (try (f permissions request)
         (catch java.lang.AssertionError assertion
           {:status 403
            :body (join (str action \:)
                        "insufficient permissions to perform this action."
                        (.getMessage assertion))}))))

(defn inflate-request
  [request]
  (let [locale-code (-> request :params :locale)
        locale (if (or (nil? locale-code) (empty? locale-code) (= "global" locale-code))
                 nil
                 (model/pick :locale {:where {:code locale-code}}))]
    (assoc request :locale locale)))

(defn permissions
  [request]
  ((juxt identity #(->> % all-permissions (itemize-by :model-id)))
   (role-id request)))


  (defn part-title
  [field]
  (let [target (model/pick :model {:where {:id (:target-id field)} :include {:fields {}}})]
    (-> target :fields first :slug)))

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
     :position-slug (str (:slug association) "-position")}))

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
                             (not (:join-model (model/models (:target-id a)))))) fields)))))

(defn human-friendly-fields
  "returns the set of fields that a human can read - is a bit hacky"
  [model]
  (let [fields (:fields model)
        stripped  (remove #(or (.endsWith (:slug %) "-id")
                               (.endsWith (:slug %) "-position")
                               (.endsWith (:slug %) "-at")
                               (= (:type %) "collection")
                               (= (:type %) "link")
                               ;; (= (:type %) "boolean")
                               )
                          fields)
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
  {:status 200 :body (generate-string data) :headers {"Content-Type" "application/json"}})

(defn part
  [f col]
  (let [groups (group-by f col)
        yes (get groups true)
        no (get groups false)]
    [yes no]))

(defn index
  [request]
  (with-permissions "index" request
    (fn [permissions request]
      (let [models (gather permissions :model {:order {:id :asc}})
            [locked unlocked] (part :locked models)]
        (render (merge request {:locked locked :unlocked unlocked}))))))

(defn new
  [request]
  (with-permissions "new" request
    (fn [permissions request]
      (let [new-model-name (-> request :params :model-name)
            new-model (create permissions :model {:name (string/capitalize new-model-name)})]
        (controller/redirect (pages/route-for :admin.edit-model (dissoc (merge {:slug (:slug new-model)} (:params request)) :model-name)))))))

(defn view
  [request]
  (with-permissions "view" request
    (fn [permissions request]
      (let [model (pick permissions :model {:where {:slug (-> request :params :slug)}
                                            :include {:fields {}}
                                            :order {:position :asc}})
            models (seq (sort-by :name (-> (deref (config/draw :models)) vals set)))]
        (render (merge request {:model model :models models}))))))

(defn keyword-results
  "This inefficiently inflates search results into
  real content directly from the DB, one-by-one"
  [kw slug opts permissions]
  (let [m (model/models (keyword slug))
        ;; TODO - remove this hardcoded limit and make it work with pagination
        raw (index/search m kw (assoc opts :limit 200))
        _ (println raw)
        includes (build-includes m)
        inflated (map (fn [r] (pick permissions slug {:where {:id (:id r)} :include includes})) raw)]
    inflated))

(defn view-results
  [request]
  (with-permissions "view-results" request
    (fn [permissions request]
      (let [request (inflate-request request)
            locale (:locale request)
            params (-> request :params)
            model (pick permissions :model {:where {:slug (:slug params)} :include {:fields {}}})
            includes (build-includes model)
            order-default (or (:order params) "position")
            order {:slug (first (clojure.string/split order-default #" "))
                   :direction (if (.endsWith order-default "desc") "desc" "asc")}
            _ (println order-default order)
            kw-results (when-not (empty? (:keyword params))
                         (keyword-results (:keyword params) (:slug params) {:locale (-> locale :code)} permissions))
            spec {:limit (:limit params)
                  :offset (:offset params)
                  :include includes
                  :locale (-> locale :code)
                  :order (model/process-order order-default)}
            _ (log/debug spec)
            results (or kw-results (gather permissions (-> request :params :slug) spec))
        friendly-fields (human-friendly-fields model)
        order-info (order-info model)]
    (if-let [locale (-> request :locale)]
      (log/debug (str "Locale is " (:code locale)))
      (log/debug "Locale is global"))
    (render (merge request {:results results
                            :model model
                            :fields friendly-fields
                            :allows-sorting true
                            :order order
                            :order-info order-info
                            :pager (helpers/add-pagination results {:page-size (or (:size params) 20)
                                                                    :page-slug (-> request :page :slug)
                                                                    :current-page (:page params)})}))))))

(defn new-field
  [request]
  (with-permissions "new-field" request
    (fn [permissions request]
      (let [params (-> request :params)
            field-name (:field-name params)
            field-type (:field-type params)
            searchable (= (:searchable params) "yes")
            reciprocal-name (:reciprocal-name params)
            target-id (:target-id params)
            link-id (:link-id params)
            fmt (:format params)
            description (:description params)
            ;; extra bits here, validate, etc
            model (pick permissions :model {:where {:slug (-> request :params :slug)} :include {:fields {}}})
            new-field (if (not (nil? target-id))
                        {:name (string/capitalize field-name)
                         :type field-type
                         :searchable searchable
                         :description description
                         :target-id target-id
                         :reciprocal-name (string/capitalize reciprocal-name)}
                        {:name (string/capitalize field-name)
                         :searchable searchable
                         :link-id link-id
                         :format fmt
                         :description description
                         :type field-type})
            new-model (update permissions :model (:id model) {:fields [ new-field ] })]
        (controller/redirect (pages/route-for :admin.edit-model
                                              (dissoc (:params request)
                                                      :field-name
                                                      :field-type
                                                      :searchable
                                                      :target-id
                                                      :format
                                                      :description
                                                      :reciprocal-name)))))))

(defn edit
  [request]
  (view request))

(defn edit-instance
  [request]
  (with-permissions "edit-instance" request
    (fn [permissions request]
      (let [request (inflate-request request)
            model-slug (-> request :params :slug)
            model (pick :model {:where {:slug model-slug} :include {:fields {}}})
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
                    (pick permissions (keyword (:slug model)) {:where {:id (-> request :params :id)} :include include})
                    {})]
    (render (merge {:model model
                    :bulk? (and (> (count ids) 0) (not specific?))
                    :instance-ids (generate-string ids)
                    :instance instance} request))))))

(defn edit-instance-post
  [request]
  (with-permissions "edit-instance-post" request
    (fn [permissions request]
      (let [model-slug (-> request :params :slug)
            edited-instance (dissoc (:params request) :slug)
            updated-instance (create permissions model-slug edited-instance)]
        (println updated-instance)
        (controller/redirect (pages/route-for :admin.edit-model-instance {:id (:id updated-instance) :slug model-slug})
                             {:cookies {"success-message" {:value (str "You successfully updated this " model-slug)}}})))))

(defn create-instance
  [request]
  (edit-instance request))

(defn editor-for
  ;; given a model slug, generates an editor for that model
  [request]
  (with-permissions "editor-for" request
    (fn [permissions request]
      (let [request (inflate-request request)
            model (pick permissions :model {:where {:slug (-> request :params :model)} :include {:fields {}}})
            template (template/find-template (util/pathify ["content" "models" "instance" "_edit.html"]))]
        (render (merge request {:template template :model model}))))))


(defn find-content
  [params]
  (with-permissions "find-content" params
    (fn [permissions params]
      (let [model (pick :model {:where {:slug (:model params)} :include {:fields {}}})
            include (build-includes model)
            where (if (:where params)
                    (model/process-where (:where params))
                    (if (empty? (:id params)) {} {:id (:id params)}))
            order (if (:order params) (model/process-order (:order params)) {})
            locale-code (if (or (nil? (:locale-code params)) (empty? (:locale-code params)))
                          nil
                          (:locale-code params))
            raw-content (gather permissions (:slug model) {:where where
                                                           :include include
                                                           :limit (:limit params)
                                                           :offset (:offset params)
                                                           :results :clean
                                                           :locale locale-code})
            content (map #(if (= (:slug model) "asset")
                            (assoc % :path (asset/asset-path %))
                            %) raw-content)]
        content))))

(defn find-associated-content
  [permissions params]
  (let [model (model/models (keyword (:model params)))
        association (get-in model [:fields (keyword (:field params))])
        assoc-name (-> association :row :slug)
        assoc-type (-> association :row :type)
        target (pick permissions :model {:where {:id (-> association :row :target-id)} :include {:fields {}}})
        include {(keyword (-> association :row :slug)) (build-includes target)}
        join-include (if (= (-> association :row :type) "link")
                       (assoc include (keyword (str assoc-name "-join")) {})
                       include)
        _ (println join-include)
        where (if (empty? (:id params)) {} {:id (:id params)})
        locale-code (if (or (nil? (:locale-code params)) (empty? (:locale-code params)))
                      nil
                      (:locale-code params))
        raw-content (gather permissions (:slug model) {:where where
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
  (with-permissions "editor-associated-content" request
    (fn [permissions request]
      (let [params (-> request :params)
            model (model/models (keyword (:model params)))
            association (get-in model [:fields (keyword (:field params))])
            target (pick :model {:where {:id (-> association :row :target-id)} :include {:fields {}}})
            template (template/find-template
                      (util/pathify ["content" "models" "instance" (or (:template params) "_collection.html")]))
            stuff (find-associated-content permissions params)
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
        (json-response response)))))

(defn editor-content
  [request]
  (with-permissions "editor-content" request
    (fn [permissions request]
      (let [request (inflate-request request)
            params (-> request :params)
            model (pick permissions :model {:where {:slug (:model params)} :include {:fields {}}})
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
          :state (if-not (contains? params :id) (:results pager) instance)})))))

(defn bulk-editor-content
  [request]
  (with-permissions "bulk-editor-content" request
    (fn [permissions request]
      (let [request (inflate-request request)
            params (:params request)
            model-slug (:model params)
            model (pick permissions :model {:where {:slug model-slug} :include {:fields {}}})
            id-list (clojure.string/split (:id params) #"[,:]")
            inflated (remove nil? (map #(pick permissions model-slug {:where {:id %}}) id-list))
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
          :inflated inflated})))))

(defn json-payload
  [request]
  (:data (walk/keywordize-keys (-> request :json-params))))

(defn remove-link
  [request]
  (with-permissions "remove-link" request
    (fn [[role-id permissions] request]
      (let [payload (json-payload request)
            model (model/models (keyword (:model payload)))
            _ (has-perms model permissions [:write] role-id)
            association (get-in model [:fields (keyword (:field payload))])
            deleted (link/remove-link association (:id payload) (:target-id payload))]
        (json-response deleted)))))

; updates multiple models.  needs some validation/idiot-proofing.
(defn update-all
  [request]
  (with-permissions "update-all" request
    (fn [permissions request]
      (let [payload (json-payload request)
            updated (map (fn [x]
                           (vector
                            (:model x)
                            (create permissions (keyword (:model x)) (:fields x) (or (:opts x) {}))))
                         payload)
            results (doall (map second updated))]
        (when-not (empty? (set/intersection #{"model" "field"} (set (map :model payload))))
          (log/debug "Reloading model, clearing query cache!")
          (query/clear-queries)
          (model/init))
        (when-not (empty? (set/intersection #{"page"} (set (map :model payload))))
          (println "RESETTING HANDLER!!")
          (handler/reset-handler)
          )
        (json-response results)))))

(defn reorder-all
  [request]
  (with-permissions "reorder-all" request
    (fn [permissions request]
      (let [payload (json-payload request)
            association-slug (:association payload)
            id (:id payload)
            items (doall (map (fn [x] {:id (Integer/parseInt (:id x)) :position (:position x)}) (:items payload)))
            _ (has-perms (model/models (:model payload)) permissions [:write])
            results (if (and association-slug id)
                      (do
                        (println (str "reordering " (:association payload) " of " (:model payload) " " (:id payload)
                                      " to " items))
                        (model/order (:model payload)
                                     (:id payload)
                                     (:association payload)
                                     items))
                      (model/order (:model payload) items))]
        (json-response results)))))

; this is too drastic and should probably have some sanity checking.
(defn delete-all
  [request]
  (with-permissions "delete-all" request
    (fn [permissions request]
      (let [payload (json-payload request)
            results (map #(destroy permissions (keyword (:model %)) (:id %)) payload)]
        (query/clear-queries)
        (model/init)
        (json-response results)))))

(defn find-all
  [request]
  (with-permissions "find-all" request
    (fn [permissions request]
      (let [model (or (keyword (-> request :params :model)) :model)
            include (-> request :params :include)]
        (check-includes model {:include include} permissions [:read])
        (json-response (model/find-all model {:include include}))))))

(defn find-one
  [request]
  (with-permissions "find-one" request
    (fn [permissions request]
      (let [params (-> request :params)
            slug (or (keyword (:model params)) :model)
            include (:include params)
            where (if (:slug params) {:slug (:slug params)} {:id (:id params)})]
        (json-response (pick permissions slug {:where where :include (model/process-include include)}))))))

(defn to-route
  [request]
  (controller/redirect (pages/route-for (-> request :params :page keyword) (dissoc (:params request) :action :page))))

(defn reindex
  [request]
  (let [model (model/models (keyword (-> request :params :slug)))]
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
                :content-type (:content-type upload)
                :size (:size upload)})
        dir (asset/asset-dir asset)
        location (asset/asset-location asset)
        path (asset/asset-path asset)]
    (if (config/draw :aws :bucket)
      (asset/upload-to-s3 location (-> params :upload :tempfile))
      (asset/persist-asset-on-disk dir path (:tempfile upload)))
    (json-response {:state (assoc asset :path path)})))

(defn list-controllers-and-actions
  [request]
  (let [matched (map #(vector (str %) (second (re-find #"\.controllers\.(.+)$" (str %)))) (all-ns))
        filtered (remove #(nil? (second %)) matched)
        mapped (map #(assoc {} :namespace (first %) :path (second %)) filtered)
        arg-check (fn [n] (for [kv (ns-publics n)
                                :when (some #(and (= 1 (count %))
                                                  (.startsWith (name (first %)) "req")) (:arglists (meta (second kv))))] (first kv)))
        actioned (map #(assoc %
                  :actions (-> % :namespace symbol arg-check sort)) mapped)
        ]
    (json-response actioned)))

(defn api
  ;; Cheesy way to create only one route for many functions.
  ;; This will go away, don't worry.  Just doing this to get up and running quickly.
  [request]
  (let [request (inflate-request request)]
    (condp = (-> request :params :action)
      "editor-for" (editor-for request)
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
      "list-controllers-and-actions" (list-controllers-and-actions request)
      "bulk-editor-content" (bulk-editor-content request)
      {:status 404 :body "Awwwwww snap!"})))
