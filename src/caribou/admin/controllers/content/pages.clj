(ns caribou.admin.controllers.content.pages
  (:require [caribou.model :as model]
            [caribou.app.controller :as controller]
            [caribou.admin.rights :as rights]
            [caribou.admin.helpers :as helpers]))

(defn all-helpers []
  helpers/all)

(defn render [params]
  (controller/render (merge (all-helpers) params)))

(defn index
  [request]
  (rights/with-permissions "pages/index" request
    (fn [permissions request]
      (let [model (rights/pick permissions :model {:where {:name "Page"}})]
        (render (assoc request :model model))))))
