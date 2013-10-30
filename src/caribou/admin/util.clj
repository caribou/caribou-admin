(ns caribou.admin.util
  (:require [caribou.model :as model]))

(defn best-title-field
  "Returns a best-guess at the most ideal title field
  in a model's field collection."
  [model]
  (let [_ model
        source-model (get (model/models) (-> model :slug keyword))
        source-fields (vals (:fields source-model))
        fields (if (nil? (:fields model))
                 (sort-by :model-position (map :row source-fields))
                 (:fields model))]
    (or (first (filter #(and (not= (:slug %) "uuid") (= (:type %) "string")) fields))
        (first (filter #(= (:type %) "text") fields))
        (first fields))))
