(ns caribou.admin.helpers
  (:require [clj-time.format :as format]
            [caribou.model :as model]))

(import java.util.Date)
(import java.text.SimpleDateFormat)

(defn value-for-key [m key]
	"Pull a value from `m` by keyword `key`"
  (get m (keyword key)))

;; pull date and time bits out of a date-field
(defn date-year [m key]
  (if-let [date (value-for-key m key)]
    (+ (. date getYear) 1900)
    nil))

(defn date-month [m key]
  (if-let [date (value-for-key m key)]
    (+ (. date getMonth) 1)
    nil))

(defn date-day [m key]
  (if-let [date (value-for-key m key)]
    (+ (. date getDay))
    nil))

(defn yyyy-mm-dd [m key]
  (let [frm (java.text.SimpleDateFormat. "yyyy-MM-dd")
        date (value-for-key m key)]
    (if-not (nil? date)
      (.format frm date)
      nil)))

(defn current-date []
  (model/current-timestamp))

; this is nonsense
(defn yyyy-mm-dd-or-current [m key]
  (if-let [date-string (yyyy-mm-dd m key)]
    date-string
    (yyyy-mm-dd {:d (current-date)} :d)))

(defn asset-is-image [m key]
  (if-let [asset (value-for-key m key)]
    (.startsWith (or (:content_type asset) "") "image")))

(defn asset-path [m key]
  (if-let [asset (value-for-key m key)]
    (:path asset)))

(defn part-values [field instance]
  (let [model (model/pick :model {:where {:id (:target_id field)} :include {:fields {}}})
        results (model/gather (:slug model))
        name-field (keyword (:slug (first (:fields model))))
        value-field :id
        default-value (:default_value field)
        is-selected? (fn [v] (if (nil? instance)
                               (= v default-value)
                               (= v (get instance value-field))))
        ]
    (conj (map #(hash-map :name (name-field %) :value (value-field %) :selected (is-selected? (value-field %))) results)
          {:name "" :value "" :selected (is-selected? "")})))

(defn get-title [thing model]
  (let [best-field (first (:fields model))]
    (get thing (keyword (:slug best-field)))))

(defn get-index [collection index]
  (get collection index))

(defn get-in-helper
  ([thing path]
    (get-in-helper thing path nil))
  ([thing path default]
    (let [spl (clojure.string/split path #"\.")
          bits (map keyword spl)]
      (get-in thing bits default))))

(defn item-count
  [field instance]
  (count (value-for-key instance (:slug field))))

(defn has-items
  [field instance]
  (> (item-count field instance) 0))

(defn position-of
  [instance field-name]
  (let [position-field-name (or field-name "position")
        position (or (get instance (keyword position-field-name))
                     (get-in instance [:join (keyword position-field-name)])
                     0)]
    (println position-field-name " is " (str position))
    position))

(defn join-model?
  [field]
  (:join_model (@model/models (:target_id field))))

; this is not technically a helper... it should live somewhere else
(defn add-pagination
  "generates pagination information for a given set of results.  You can inject this
   into your params before you render your page and use them during rendering
   to build a pager, etc."
  [results opts]
  (let [page-size (:page-size opts)
        page-slug (:page-slug opts)
        current-page (:current-page opts)
        current    (or (if (string? current-page) (Integer/parseInt current-page) current-page) 0)
        size       (or (if (string? page-size) (Integer/parseInt page-size) page-size) 50) ;; get default from somewhere?
        page-count (/ (count results) size)]
    {:pagination?       (> page-count 1)
     :previous-page?    (> current 0)
     :previous-page     (dec current)
     :next-page?        (< current (dec page-count))
     :next-page         (inc current)
     :pages             (doall (range page-count))
     :current           current
     :pagination-target (if-not (empty? page-slug)
                          (keyword page-slug)
                          nil)
     :results           (take size (drop (* current size) results))
     :start-index       (* current size)
     :opts              opts
     }))

;; is there an easier way to export all the functions in a map?
(defn all []
	{:value-for-key value-for-key
	 :date-year date-year
	 :date-month date-month
	 :date-day date-day
   :current-date current-date
   :yyyy-mm-dd yyyy-mm-dd
   :yyyy-mm-dd-or-current yyyy-mm-dd-or-current
   :asset-is-image asset-is-image
   :asset-path asset-path
	 :and (fn [a b] (and a b))
	 :or (fn [a b] (or a b))
   :part-values part-values
   :get-title get-title
   :has-items has-items
   :item-count item-count
   :position-of position-of
   :get-in get-in-helper
   :join-model? join-model?
	 })
