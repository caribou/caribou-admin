(ns caribou.admin.controller
  (:require [antlers.core :as antlers] 
            [caribou.app.controller :as controller]))

(defn render
  ([format params]
     (controller/render format (assoc params :render-fn controller/render-antlers-template)))
  ([params]
     (controller/render (assoc params :render-fn controller/render-antlers-template))))
