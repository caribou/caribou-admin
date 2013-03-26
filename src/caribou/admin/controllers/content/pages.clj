(ns caribou.admin.controllers.content.pages
  (:use caribou.app.controller
        [clojure.string :only (join)])
  (:require [caribou.model :as model]))

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
