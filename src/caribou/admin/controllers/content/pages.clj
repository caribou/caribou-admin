(ns caribou.admin.controllers.content.pages
  (:require [caribou.model :as model]
            [caribou.app.controller :as controller]
            [caribou.admin.helpers :as helpers]))

(defn all-helpers [] 
  helpers/all)

(defn render [params]
  (controller/render (merge (all-helpers) params)))

(defn index
  [request]
  (let [model (-> @model/models :page)]
    (render (assoc request :model model))))

(defn view
  [params]
  (render params))

(defn edit
  [params]
  (render params))

(defn create
  [params]
  (render params))

(defn update
  [params]
  (render params))

(defn destroy
  [params]
  (render params))

(defn new
  [request]
  (render request))
