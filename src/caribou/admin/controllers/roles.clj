(ns caribou.admin.controllers.roles
  (:use [caribou.admin.controller]
        [caribou.app.pages :only [route-for select-route]])
  (:require [caribou.admin.rights :as rights]
            [caribou.app.controller :as controller]
            [caribou.model :as model]
            [caribou.logger :as log]
            [caribou.permissions :as permissions]))

(defn edit-role
  [{permissions :permissions :as request}]
  (let [role (rights/pick permissions :role
                          {:where {:title (-> request :params :title)}
                           :include {:permissions {:model {}}}})
        extract-perm (fn [p]
                       (let [m (:mask p)]
                         {:read-checked
                          (if (permissions/check-read m) "checked" "")
                          :write-checked
                          (if (permissions/check-write m) "checked" "")
                          :create-checked
                          (if (permissions/check-create m) "checked" "")
                          :delete-checked
                          (if (permissions/check-delete m) "checked" "")
                          :name (-> p :model :slug)}))
        perms (map extract-perm (:permissions role))
        perms (sort-by :name perms)
        request (assoc request :title (:title role) :tasks perms)]
    (render request)))

(def create-role render)

(declare submit-edit-role)

(defonce rq (atom nil))

(defn default-mask
  [params]
  (let [{:keys [title
                all-default
                update-default
                read-default
                edit-default
                create-default
                delete-default]} params
         permset (map first
                      (filter #(or (second %)
                                   all-default)
                              [[:read read-default]
                               [:edit edit-default]
                               [:create create-default]
                               [:destroy delete-default]
                               [:update update-default]]))
         default-mask (apply permissions/mask permset)]
    default-mask))

(defn submit-create-role
  [{:keys [params permissions] :as request}]
  (reset! rq request)
  ;; not holding onto this, because we need to pick with permissions anyway
    (rights/create permissions :role {:title (:title params)
                                      :default-mask (default-mask params)})
    (submit-edit-role request))

(defonce rq2 (atom nil))

(defn submit-edit-role
  [{:keys [params permissions] :as request}]
  (reset! rq2 request)
  (let [{title :title} params
        role (rights/pick permissions :role
                          {:where {:title title}
                           :include {:permissions {:model {}}}})
        default-mask (default-mask params)
        keystrings (map name (filter keyword? (keys (:params request))))
        split- (fn [s]
                 (->> s (split-with (comp not #{\-}))
                      (map #(->> %
                                 (drop-while #{\-})
                                 (apply str)))))
        keyvecs (map split- keystrings)
        perm-key? (fn [k]
                    (get #{"create" "write" "read" "delete"} (first k)))
        perm-keys (filter perm-key? keyvecs)
        perm-map (group-by last perm-keys)
        old-perms (reduce (fn [mp [k v]] (assoc mp k v)) {}
                          (map #(vector (-> % :model :slug keyword)
                                        [(:mask %) (:id %)])
                               (:permissions role)))
        null-perms (reduce (fn [mp [k v]] (assoc mp k v)) {}
                           (map (fn [x] [(-> x :model :slug keyword) 0])
                                (:permissions role)))
        perm-masks (into {}
                         (map
                          (fn [[slug perms]]
                            [(keyword slug)
                             (apply permissions/mask
                                    (map (comp keyword first) perms))])
                          perm-map))
        all-masks (merge null-perms perm-masks)]
    (doseq [perm all-masks]
      (let [key (first perm)
            orig-perm (key old-perms)
            id (second orig-perm)]
        (rights/update permissions :permission
                       id {:mask (second perm)})))
    (rights/update permissions :role
                   (:id role) {:default-mask default-mask})
    (controller/redirect (route-for :admin.edit-role
                         (select-route :admin.edit-role (:params request)))
              (:session request))))
