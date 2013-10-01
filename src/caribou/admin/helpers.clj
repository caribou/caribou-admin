(ns caribou.admin.helpers
  (:require [clj-time.format :as format]
            [caribou.app.pages :as pages]
            [caribou.app.helpers :as app-helpers]
            [caribou.model :as model]
            [caribou.admin.rights :as rights]
            [caribou.admin.util :as util]))

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
    (+ (. date getDate))
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

(defn hh-mm [m key]
  (if-let [date (value-for-key m key)]
    (.format (java.text.SimpleDateFormat. "HH:mm") date)
    "00:00"))

(defn safe-route-for
  [slug & args]
  (pages/route-for slug (pages/select-route slug (apply merge args))))

(defn asset-is-image
  ([asset]
    (.startsWith (or (:content-type asset) "") "image"))
  ([m key]
    (if-let [asset (value-for-key m key)]
      (.startsWith (or (:content-type asset) "") "image"))))

(defn asset-path [m key]
  (if-let [asset (value-for-key m key)]
    (:path asset)))

(defn resize-in
  [instance slug opts]
  (let [asset (get instance (keyword slug))]
    (app-helpers/resize-image asset opts)))

;; No, it's not good to hit the DB in a helper... but in this case,
;; where it's only for an admin app, and we need to grab this
;; info dynamically at render-time, it's much, much easier to
;; do this than to try to do it all in the controller. IMHO.
(defn part-values
  [field instance permissions]
  (let [source-model (model/models (:model-id field))
        id-field-slug (keyword (str (:slug field) "-id"))
        id-field (-> source-model :fields id-field-slug :row)
        default-value (:default-value id-field)
        target-model (rights/pick permissions :model {:where {:id (:target-id field)}
                                  :include {:fields {}}})
        results (rights/gather permissions (:slug target-model))
        ;;name-field (keyword (:slug (first (:fields target-model))))
        name-field (-> (util/best-title-field target-model) :slug keyword)
        value-field :id
        is-selected? (fn [v] (if (nil? instance)
                               (= (str v) (str default-value))
                               (= (str v) (str (get instance value-field)))))
        part-values (conj
                     (map
                      (fn [datum]
                       {:name (name-field datum)
                        :value (value-field datum)
                        :selected (is-selected? (value-field datum))})
                       results)
                      {:name "" :value "" :selected (is-selected? "")})]
    part-values))

(defn enum-values [field instance]
  (let [model (get (model/models) (:model-id field))
        values (get-in model [:fields (keyword (:slug field)) :row :enumerations])
        value-field (keyword (str (:slug field) "-id"))
        default-value (:default-value field)
        is-selected? (fn [v] (if (nil? instance)
                               (= v default-value)
                               (= v (get instance value-field))))
        mapped (map #(hash-map :name (:entry %)
                               :value (:id %)
                               :selected (is-selected? (:id %))) values)]
        (if (:required field)
          mapped
          (conj mapped {:name "" :value "" :selected (is-selected? nil)}))))

(defn get-title [thing model]
  (let [best-field (first (:fields model))]
    (get thing (keyword (:slug best-field)))))

(defn get-index [collection index]
  (get collection index))

(defn get-in-helper
  ([thing path]
    (get-in-helper thing path nil))
  ([thing path default]
    (let [spath (or path "")
          spl (clojure.string/split spath #"\.")
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
    position))

(defn join-model?
  [field]
  (:join-model (model/models (:target-id field))))

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
     :count             (count results)
     :opts              opts
     }))

(defn system-field? [field]
  (or (#{"position" "created-at" "updated-at" "locked" "searchable" "distinct" "uuid"} (:slug field))
      (.endsWith (:slug field) "-id")
      (.endsWith (:slug field) "-position")))


(defn editable? [field params]
  (or (:editable field)
      (:show-hidden params)
      ;;; This is super-lame.
      (.endsWith (:slug field) "-key")))

;; -------- locale helpers --------

(defn locales []
  (model/gather :locale))

(defn localized-models []
  (model/gather :model {:where {:localized true}}))

(defn locale-code
  "This is the actual locale code - for 'global', this
  will be blank, and for all others it will be the code"
  [code]
  (if (or (nil? code) (empty? code) (= "global" code))
    ""
    code))

;; --------------------------------

(def all
  {:value-for-key value-for-key
   :date-year date-year
   :date-month date-month
   :date-day date-day
   :current-date current-date
   :yyyy-mm-dd yyyy-mm-dd
   :yyyy-mm-dd-or-current yyyy-mm-dd-or-current
   :hh-mm hh-mm
   :asset-is-image asset-is-image
   :asset-path asset-path
   :resize-in resize-in
   :and (fn [a b] (and a b))
   :or (fn [a b] (or a b))
   :part-values part-values
   :enum-values enum-values
   :get-title get-title
   :has-items has-items
   :item-count item-count
   :position-of position-of
   :get-in get-in-helper
   :join-model? join-model?
   :safe-route-for safe-route-for
   :system-field? system-field?
   :locales locales
   :localized-models localized-models
   :locale-code locale-code
   :equals =
   :editable? editable?
   })
