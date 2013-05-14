(ns caribou.admin.controllers.settings.model
  (:use caribou.app.controller
        [cheshire.core :only (generate-string)])
  (:require [caribou.permissions :as permissions]
            [caribou.admin.rights :as rights]
            [caribou.app.pages :as pages]))

(defn part
  [f col]
  (let [groups (group-by f col)
        yes (get groups true)
        no (get groups false)]
    [yes no]))

(defn index
  [{[role-id perms :as permissions] :permissions :as request}]
  (let [models (rights/gather permissions :model {:order {:id :asc}})
        [locked unlocked] (part :locked models)]
    (render (merge request {:locked locked :unlocked unlocked}))))

(defn view
  [{[role-id perms :as permissions] :permissions :as request}]
  (let [model (rights/pick permissions :model
                           {:where {:id (-> request :params :id)}
                            :include {:fields {}}})
        model-fields (-> model :fields)
        field-names (map :name model-fields)
        field-types (map :type model-fields)]
    (render (assoc request
              :model model
              :field-names field-names
              :field-types field-types))))

(defn model-attribute
  [{[role-id perms :as permissions] :permissions :as request}]
  (let [ids (-> request :params :id)
        model-id (first ids)
        attr-id (last ids)
        model (rights/pick permissions :model
                           {:where {:id model-id} :include {:fields {}}})
        fields (-> model :fields)
        attr (first (filter #(= (Integer/parseInt attr-id) (% :id)) fields))]
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
