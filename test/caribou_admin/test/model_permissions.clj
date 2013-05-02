(ns caribou-admin.test.model-permissions
  (:require [clojure.test :refer [deftest testing is]]
            [caribou
             [model :as model]
             [config :as config]]
            [caribou.admin.controllers.content.models :as models-controller]))

(def requests
  {; :editor-for {} ;; deprecated?
   :editor-content {:params
                    {:site "admin",
                     :locale "global",
                     :action "editor-content",
                     :locale-code "",
                     :model "glurg"}}
   :editor-associated-content {:params
                               {:site "admin",
                                :locale "global",
                                :action "editor-associated-content",
                                :field "siphons",
                                :page "0",
                                :template "_paged_collection.html",
                                :id "1",
                                :model "page"}}
   :update-all {:params
                {:site "admin",
                 :locale "global",
                 "data" [{"model" "glurg",
                          "fields" {"mb",
                                    "jioefhj][ aq09ju 09 24t90uv6u40w"},
                          "opts" {}}],
                 :action "update-all"}}
   :reorder-all {:params
                 {:site "admin",
                  :locale "global",
                  "data" {"model" "model",
                          "association" "fields",
                          "id" 19,
                          "items"
                          [{"id" "272", "position" 1}
                           {"id" "278", "position" 2}
                           {"id" "273", "position" 3}
                           {"id" "274", "position" 4}
                           {"id" "275", "position" 5}
                           {"id" "276", "position" 6}
                           {"id" "277", "position" 7}
                           {"id" "279", "position" 8}
                           {"id" "292", "position" 9}]},
                  :action "reorder-all"}}
   :find-all {:params
              {:site "admin",
               :locale "global",
               :action "find-all",
               :model "page"}}
   :find-one {:params
              {:site "admin",
               :locale "global",
               :action "find-one",
               :slug "glurg",
               :include "fields",
               :model "model"}}
   :delete-all {:params
                {:site "admin",
                 :locale "global",
                 "data" [{"model" "field",
                          "id" "233"}],
                 :action "delete-all"}}
   :to-route {:params
              {:site "admin",
               :locale "global",
               :action "to-route",
               :slug "glurg",
               :page "admin.results"}}
   :upload-asset {}
   :remove-link {}
   :reindex {}
   :bulk-editor-content {}})

(deftest access
  (config/init)
  (model/init))
