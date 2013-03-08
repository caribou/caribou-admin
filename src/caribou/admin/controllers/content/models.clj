(ns caribou.admin.controllers.content.models
  (:use [cheshire.core :only (generate-string)])
  (:require [caribou.model :as model]
            [caribou.field.link :as link]
            [caribou.app.controller :as controller]
            [clojure.string :as string]
            [clj-time.core :as timecore]
            [clojure.pprint :as pprint]
            [clojure.walk :as walk]
            [caribou.util :as util]
            [caribou.app.pages :as pages]
            [caribou.app.template :as template]
            [caribou.asset :as asset]
            [caribou.config :as config]
            [caribou.admin.helpers :as helpers]))

(defn safe-route-for
  [slug & args]
  (pages/route-for slug (pages/select-route slug (apply merge args))))

(defn part-title
  [field]
  (let [target (model/pick :model {:where {:id (:target_id field)} :include {:fields {}}})]
    (-> target :fields first :slug)))

(defn order-info
  ([model]
    (let [internal-model (@model/models (keyword (:slug model)))]
    {:model internal-model :field (-> internal-model :fields :position :row) :field-path "position" :id-path "id"}))
  ([model association]
    (let [target (@model/models (-> association :row :target_id))
          order-model (if (= (-> association :row :type) "link")
                        (@model/models (link/link-join-name association))
                        target)
          position-field-name (keyword (str (-> association :row :slug) "_position"))
          position-field (-> order-model :fields position-field-name :row)
          field-path (if (= (-> association :row :type) "link")
                       (str "join." (-> association :row :slug) "_position")
                       (str (-> association :row :slug) "_position"))
          id-path (if (= (-> association :row :type) "link") "join.id" "id")]
      {:model order-model :field position-field :field-path field-path :id-path id-path})))

(defn order-get-in [thing path]
  (or (helpers/get-in-helper thing path) 0))

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
  (into {}
    (map #(vector (keyword (:slug %)) {})
      (filter (fn [a] (and (some #(= (:type a) %) ["collection", "part", "link"])
                           (not (:join_model (@model/models (:target_id a)))))) (:fields model)))))

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
    (println (map #(:friendly-path %) filled))
    filled))

(defn all-helpers [] 
  ; TODO - other local helpers here
  (merge (helpers/all) {:safe-route-for safe-route-for
                        :order-get-in order-get-in}))

(defn render
  ([content-type params]
    (controller/render content-type params))
  ([params]
    (controller/render (merge (all-helpers) params))))

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
  (let [models (model/gather :model {:order {:id :asc}})
        [locked unlocked] (part :locked models)]
    (render (merge request {:locked locked :unlocked unlocked}))))

(defn new
  [request]
  (let [new-model-name (-> request :params :model-name)
        ; validate here
        new-model (model/create :model {:name (string/capitalize new-model-name)})]
    (controller/redirect (pages/route-for :edit_model (dissoc (merge {:slug (:slug new-model)} (:params request)) :model-name)))))

(defn view
  [request]
  (let [model (model/pick :model {:where {:slug (-> request :params :slug)}
                                  :include {:fields {}}
                                  :order {:position :asc}})
        models (seq (sort-by :name (-> @model/models vals set)))]
    (render (merge request {:model model :models models}))))

(defn view-results
  [request]
  (let [params (-> request :params)
        model (model/pick :model {:where {:slug (:slug params)} :include {:fields {}}})
        ;; this needs to delegate to someone else to find the list of things to show
        includes (build-includes model)
        order (or (:order params) "position")
        results (model/gather (-> request :params :slug) {:limit (:limit params)
                                                          :offset (:offset params)
                                                          :include includes
                                                          :order (model/process-order order)})
        friendly-fields (human-friendly-fields model)
        order-info (order-info model)]
    (render (merge request {:results results
                            :model model
                            :fields friendly-fields
                            :allows-sorting true
                            :order-info order-info
                            :pager (helpers/add-pagination results {:page-size (or (:size params) 20)
                                                                    :page-slug (-> request :page :slug)
                                                                    :current-page (:page params)})}))))

;; ---- manipulate model attributes ----
;; TODO:kd - edit-field should work the same.
(defn new-field
  [request]
  (let [field-name (-> request :params :field-name)
        field-type (-> request :params :field-type)
        reciprocal-name (-> request :params :reciprocal-name)
        target-id (-> request :params :target-id)
        ;; extra bits here, validate, etc
        model (model/pick :model {:where {:slug (-> request :params :slug)} :include {:fields {}}})
        ;; TODO:kd - more checking/validation
        new-field (if (not (nil? target-id))
                    {:name (string/capitalize field-name)
                     :type field-type
                     :target_id target-id
                     :reciprocal_name (string/capitalize reciprocal-name)}
                    {:name (string/capitalize field-name)
                     :type field-type})
        new-model (model/update :model (:id model) {:fields [ new-field ] })]
      (controller/redirect (pages/route-for :edit_model
                             (dissoc (:params request) :field-name
                                                       :field-type
                                                       :target-id
                                                       :reciprocal-name)))))

;;-------- *-field should not be needed; everything can be done via model-api.

(defn edit
  [request]
  (view request))

(defn edit-instance
  [request]
  (let [model-slug (-> request :params :slug)
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
        updated-instance (model/create model-slug edited-instance)
        ]
    (println updated-instance)
    (controller/redirect (pages/route-for :edit_model_instance {:id (:id updated-instance) :slug model-slug})
      {:cookies {"success-message" {:value (str "You successfully updated this " model-slug)}}})))

(defn create-instance
  [request]
  (edit-instance request))

(defn editor-for
  ;; given a model slug, generates an editor for that model
  [request]
  (let [model (model/pick :model {:where {:slug (-> request :params :model)} :include {:fields {}}})
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
        raw-content (model/gather (:slug model) {:where where
                                                 :include include 
                                                 :limit (:limit params) 
                                                 :offset (:offset params)})
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
        ;order (if (:order params) (model/process-order (:order params)) {})
        raw-content (model/gather (:slug model) {:where where
                                                 :include join-include 
                                                 :limit (:limit params) 
                                                 :offset (:offset params)})
        instance (first raw-content)
        associated-content ((keyword assoc-name) instance)
        ;join-content (if (= assoc-type "link")
        ;               ((keyword (str assoc-name "_join")) instance)
        ;               nil)
        content (map #(if (= (:slug model) "asset")
                          (assoc % :path (asset/asset-path %))
                          %) associated-content)]
        ;joined-content (if (= (count join-content) (count content))
        ;                 (map (fn [a b] (assoc a :join b)) content join-content)
        ;                 content)]
    content))

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
        content (find-associated-content params)
        pager (helpers/add-pagination content
                {:page-size (or (:size params) 20)  ;; TODO:kd - put default page size into config
                 :current-page (:page params)})
        friendly-fields (human-friendly-fields target)
        order-info (order-info model association)
        response {:template (:body (render (merge request {:template template
                                                           :model target
                                                           :fields friendly-fields
                                                           :order-info order-info
                                                           :pager pager
                                                           :results (:results pager)
                                                           })))
                  :model target
                  :state (:results pager)}]
    (json-response response)))

(defn editor-content
  [request]
  (let [params (-> request :params)
        model (model/pick :model {:where {:slug (:model params)} :include {:fields {}}})
        template (template/find-template 
                   (util/pathify ["content" "models" "instance" (or (:template params) "_edit.html")]))
        results (find-content params)
        instance (if-not (empty? (:id params))
                   (first results))
        friendly-fields (human-friendly-fields model)
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
                                                })))
       :model model
       :state (if-not (contains? params :id) (:results pager) instance)})))

(defn bulk-editor-content
  [request]
  (let [model-slug (-> request :params :model)
        model (model/pick :model {:where {:slug model-slug} :include {:fields {}}})
        id-list (clojure.string/split (-> request :params :id) #"[,:]")
        inflated (remove nil? (map #(model/pick model-slug {:where {:id %}}) id-list))
        all-equal (fn [a b]
                    (if (map? a)
                      (if (= (:id a) (:id b)) a nil)
                      (if (= a b) a nil)))
        merged (apply (partial merge-with all-equal) inflated)
        template (template/find-template 
                   (util/pathify ["content" "models" "instance" (or (-> request :params :template) "_edit.html")]))
        ]
    (json-response
      {:template (:body (render (merge request {:template template
                                                :model model
                                                :instance merged
                                                :bulk? true
                                                :ids (-> request :param :id)
                                                :fields (human-friendly-fields model)
                                                :order-info (order-info model)
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
        deleted (link/remove-link association (:id payload) (:target-id payload))
        ]
    (json-response deleted)))

; updates multiple models.  needs some validation/idiot-proofing.
(defn update-all
  [request]
  (let [payload (json-payload request)
        _ (println payload)
        results (map #(model/create (keyword (:model %)) (:fields %)) payload)]
    (json-response results)))

; this is too drastic and should probably have some sanity checking.
(defn delete-all
  [request]
  (let [payload (json-payload request)
        results (map #(model/destroy (keyword (:model %)) (:id %)) payload)]
    (json-response results)))

; TODO:kd - unify this with find-results above
(defn find-all
  [request]
  (let [model (or (keyword (-> request :params :model)) :model)
        include (-> request :params :include)]
  (json-response (model/find-all model {:include include}))))

(defn to-route
  [request]
  (controller/redirect (pages/route-for (-> request :params :page keyword) (dissoc (:params request) :action :page))))

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

(defn api
  ;; Cheesy way to create only one route for many functions.
  ;; This will go away, don't worry.  Just doing this to get up and running quickly.
  [request]
  (condp = (-> request :params :action)
    "editor-for" (editor-for request)
    "editor-content" (editor-content request)
    "editor-associated-content" (editor-associated-content request)
    "update-all" (update-all request)
    "find-all" (find-all request)
    "delete-all" (delete-all request)
    "to-route" (to-route request)
    "upload-asset" (upload-asset request)
    "remove-link" (remove-link request)
    "bulk-editor-content" (bulk-editor-content request)
    {:status 404 :body "Awwwwww snap!"}))
