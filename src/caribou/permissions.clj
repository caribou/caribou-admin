(ns caribou.permissions
  (:require [caribou.model :as model]))

(def read-bit (bit-shift-left 1 3))
(def write-bit (bit-shift-left 1 2))
(def create-bit (bit-shift-left 1 1))
(def delete-bit (bit-shift-left 1 0))

(def bits 
  {:read read-bit
   :write write-bit
   :create create-bit
   :delete delete-bit})

(defn rights
  [user model]
  (let [user (model/pick :account {:where {:id (:id user)}
                                :include {:role {:gives-permissions {}}}})
        permissions (-> user :role :gives-permissions)
        permission (first (filter #(= (:model-id %) (:id model)) permissions))]
    (:mask permission)))

(defn check-bit
  [check mask]
  (= check (bit-and mask check)))

(defn check-read
  [mask]
  (check-bit read-bit mask))

(defn read?
  [user model]
  (-> (rights user model) check-read))

(defn check-write
  [mask]
  (check-bit write-bit mask))

(defn write?
  [user model]
  (-> (rights user model) check-write))

(defn check-create
  [mask]
  (check-bit create-bit mask))

(defn create?
  [user model]
  (-> (rights user model) check-create))

(defn check-delete
  [mask]
  (check-bit delete-bit mask))

(defn delete?
  [user model]
  (-> (rights user model) check-delete))

(defn has
  "check for some set of permissions given a user and model"
  [user model permissions]
  (let [mask (rights user model)
        bit-array (map #(get bits % 0) permissions)
        ;; set all bits for the permissions requested
        permsmask (reduce bit-or 0 bit-array)
        ;; clear all bits but the ones we are seeking
        mask (bit-and mask permsmask)]
    (= mask permsmask)))

(defn mask
  "create a mask representing a specific combination of permissions"
  [& flags]
  (apply bit-or (map #(get bits % 0) (conj flags 0))))
