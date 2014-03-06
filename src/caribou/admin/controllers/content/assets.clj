(ns caribou.admin.controllers.content.assets
  (:use caribou.admin.controller)
(:require [caribou.model :as model]
          [caribou.admin.rights :as rights]))
  
(defn index
  [params]
  (render params))

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

(defn modal-chooser
  [request]
  (render request))

(defn matches
  [{permissions :permissions :as request}]
  (let [search (-> request :params :search)
        matches (rights/gather permissions :asset {:where search})]
    (render (merge {:assets matches} request))))
