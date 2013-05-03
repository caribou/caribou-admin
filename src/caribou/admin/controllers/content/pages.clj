(ns caribou.admin.controllers.content.pages
  (:require [caribou.model :as model]
            [caribou.app.controller :as controller]
            [caribou.admin.helpers :as helpers]))

(defn all-helpers []
  helpers/all)

(defn render [params]
  (controller/render (merge (all-helpers) params)))

(defn new
  [request]
  (render request))

(defn index
  [request]
  (let [model (model/pick :model {:where {:name "Page"}})]
    (render (assoc request :model model))))
