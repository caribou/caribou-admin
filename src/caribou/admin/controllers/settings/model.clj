(ns caribou.admin.controllers.settings.model
  (:use caribou.app.controller
        [cheshire.core :only (generate-string)])
  (:require [caribou.model :as model]
            [caribou.app.pages :as pages]))
  


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

(defn view
  [request]
  (let [model (model/pick :model {:where {:id (-> request :params :id)} :include {:fields {}}})
        model-fields (-> model :fields)
        field-names (map :name model-fields)
        field-types (map :type model-fields)
        ]
    (render (merge request {:model model :field-names field-names :field-types field-types}))))

(defn model-attribute
  [request]
  ;; (println (str (first (-> request :params :id))))
  ;; (println (str (last (-> request :params :id))))
  (let [ids (-> request :params :id)
        model-id (first ids)
        attr-id (last ids)
        model (model/pick :model {:where {:id model-id} :include {:fields {}}})
        fields (-> model :fields)
        attr (first (filter #(= (Integer/parseInt attr-id) (% :id)) fields))]
    (println (type (Integer/parseInt attr-id)))
  {:status 200 :body (generate-string attr {:pretty true})}))

(defn edit
  [request]
  (render request))

(defn create
  [request]
  (render request))

(defn update
  [request]
  (render request))

(defn destroy
  [request]
  (render request))
