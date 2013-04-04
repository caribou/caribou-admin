(ns caribou.admin.controllers.content.pages
  (:require [caribou.model :as model]
            [caribou.app.controller :as controller]
            [caribou.admin.helpers :as helpers]))

(defn all-helpers []
  helpers/all)

(defn render [params]
  (controller/render (merge (all-helpers) params)))

(defn index
  ;[params]
  ;(let [pages (model/gather :page
                            ;{:order {:id :asc}
                             ;:where {:site_id 1}})
        ;admin-pages (model/gather :page
                                  ;{:order {:id :asc}
                                   ;:where {:site_id 2}})

    ;page-tree
    ;(add-level (model/arrange-tree pages))

    ;admin-page-tree
    ;(add-level (model/arrange-tree admin-pages))

    ;;; Add bindings to params
    ;modded-params
      ;(merge params
        ;{ :pages page-tree }
        ;{ :admin-pages admin-page-tree }
      ;)
  ;]
  ;(render modded-params)))
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
