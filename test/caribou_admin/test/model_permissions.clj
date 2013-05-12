(ns caribou-admin.test.model-permissions
  (:require [clojure
             [test :as test :refer [deftest testing is]]
             [set :as set :refer [intersection subset?]]
             [string :as string]]
            [clojure.java.io :as io]
            [cheshire.core :as cheshire]
            [caribou
             [model :as model]
             [config :as config]
             [permissions :as permissions]
             [core :as caribou]]
            [caribou.app.config :as app-config]
            [caribou.admin
             [hooks :as hooks]
             [rights :as rights]]
            [caribou.admin.controllers.content
             [models :as models-controller]
             [projects :as projects]
             [assets :as assets]]))

(def models-requests
  {; :editor-for {} ;; deprecated?
   :editor-content (fn [id]
                     {:params
                      {:site "admin",
                       :locale "global",
                       :action "editor-content",
                       :locale-code "",
                       :model "page"}
                      :session {:admin {:user {:role-id id}}}})
   :editor-associated-content (fn [id]
                                {:params
                                 {:site "admin",
                                  :locale "global",
                                  :action "editor-associated-content",
                                  :field "siphons",
                                  :page "0",
                                  :template "_paged_collection.html",
                                  :id "1",
                                  :model "page"}
                                 :session {:admin {:user {:role-id id}}}})
   :update-all (fn [id]
                 {:test true ;because of a reset handler npe
                  :json-params {"data" [{"model" "page",
                                         "fields" {"name" "DELETE ME"
                                                   "controller" ""
                                                   "action" ""
                                                   "route" "invalid"},
                                         "opts" {}}]}
                  :params {:site "admin",
                           :locale "global",
                           :action "update-all"}
                  :session {:admin {:user {:role-id id}}}})
   :reorder-all (fn [id]
                  {:params
                   {:site "admin",
                    :locale "global"
                    :action "reorder-all"}
                   :json-params
                   {"data" {"model" "model",
                            "association" "fields",
                            "id" (model/models :page :id),
                            "items" (->> (model/models
                                         :page
                                         :fields)
                                         vals
                                         (map (comp :id :row))
                                         shuffle
                                         (map-indexed (fn [idx id]
                                                        {"id" (str id)
                                                         "position" idx})))}}
                   :session {:admin {:user {:role-id id}}}})
   :find-all (fn [id]
               {:params
                {:site "admin",
                 :locale "global",
                 :action "find-all",
                 :model "page"}
                :session {:admin {:user {:role-id id}}}})
   :find-one (fn [id]
               {:params
                {:site "admin",
                 :locale "global",
                 :action "find-one",
                 :slug "page",
                 :include "fields",
                 :model "model"}
                :session {:admin {:user {:role-id id}}}})
   :delete-all (fn [id field]
                 {:params
                  {:site "admin",
                   :locale "global",
                   :action "delete-all"}
                  :json-params
                  {"data" [{"model" "field",
                            "id" field}]}
                  :session {:admin {:user {:role-id id}}}})
   :to-route (fn [id]
               {:params
                {:site "admin",
                 :locale "global",
                 :action "to-route",
                 :slug "page",
                 :page "admin.results"}
                :session {:admin {:user {:role-id id}}}})
   :upload-asset (fn [id]
                   (let [name "/tmp/hello.txt" 
                         _ (spit name "Hello World!\n")
                         file (io/file name)
                         file-size (.length file)]
                   {:params {:site "admin", 
                             :locale "global",
                             "upload" {:size file-size,
                                       :tempfile file,
                                       :content-type "text/plain",
                                       :filename "hello.txt"},
                             :action "upload-asset"}
                    :session {:admin {:user {:role-id id}}}}))
   :remove-link (fn [field target-id model instance id]
                  {:params {:action "remove-link"}
                   :json-params {"data" {"field" field
                                         "target-id" target-id
                                         "model" model
                                         "id" instance}}
                   :session {:admin {:user {:role-id id}}}})
   ;; no need to check perms for reindex
   #_:reindex #_(fn [id]
                  {:session {:admin {:user {:role-id id}}}})
   :bulk-editor-content (fn [models id]
                          {:params {:action "bulk-editor-content"
                                    :model "model"
                                    :id (string/join "," models)
                                    :template nil}
                           :session {:admin {:user {:role-id id}}}})})

(defn cleanup
  [old-users old-roles old-pages]
  (model/init)
  (let [users (map :id (model/gather :account))
        roles (map :id (model/gather :role))
        pages (map :id (model/gather :page))]
    (doseq [id (remove old-users users)]
      (model/destroy :account id))
    (doseq [id (remove old-roles roles)]
      (model/destroy :role id))
    (doseq [id (remove old-pages pages)]
      (model/destroy :page id))
    (doseq [slug [:child-delete-me :parent-delete-me]]
      (when-let [{id :id} (model/models slug)]
        (model/destroy :model id)))))

(defn do-caribou
  [f]
  (let [default (app-config/default-config)
        config (config/config-from-resource default "config/test.clj")
        config (caribou/init config)]
    (caribou/with-caribou config
      (hooks/init)
      (let [existing-users (set (map :id (model/gather :account)))
            existing-roles (set (map :id (model/gather :role)))
            existing-pages (set (map :id (model/gather :page)))]
        (f)
        (cleanup existing-users existing-roles existing-pages)))))

(test/use-fixtures :once do-caribou)

(deftest itemize-by
  (is (= {0 {:a 0 :b 1} 1 {:a 1 :b 1}}
         (rights/itemize-by :a [{:a 0 :b 1} {:a 1 :b 1}]))))

(defn make-role
  [mask]
  (let [{role-id :id} (model/impose :role {:where {:default-mask mask :name (str "has-" mask)}})]
    role-id))

#_(deftest inflate-request
    (let [admin (make-role (permissions/mask :write :read :create :delete))
          dummy (make-role 0)
          request (fn [role-id]
                    {:params {:locale ""}
                     :session {:admin {:user {:role-id role-id}}}})
          inflated (models-controller/inflate-request (request dummy))]
      (is (= [:permissions :locale :params :session] (keys inflated)))
      (is (= #{0} (set (map (comp :mask second) (:permissions inflated)))))))

(defn role-session
  [id]
  {:session {:admin {:user {:role-id id}}}})

(deftest has-perms
  (let [admin (make-role (permissions/mask :write :read :delete :create))
        qa (make-role (permissions/mask :read))
        dummy (make-role 0)
        all-permissions rights/all-permissions
        has-perms rights/has-perms]
    (is (has-perms 1 (all-permissions (role-session admin))
                    [:read :write :delete :create] admin))
    (is (not (has-perms 1 (all-permissions (role-session dummy))
                        [:read :write :delete :create] dummy)))
    (is (not (has-perms 1 nil [:read :write :delete :create] nil)))
    (is (not (has-perms 1 (all-permissions nil)
                        [:read :write :delete :create] nil)))
    (is (has-perms 1 (all-permissions (role-session qa)) [:read] qa))
    (is (not (has-perms 1 (all-permissions (role-session qa)) [:write] qa)))
    (is (not (has-perms 1 (all-permissions (role-session qa)) [:create] qa)))
    (is (not (has-perms 1 (all-permissions (role-session qa)) [:delete] qa)))))

(defn is-model?
  [ob]
  (subset?  #{:slug :position :name :locked :updated-at :created-at :id}
            (-> ob keys set)))

(defn test-accessible
  [response]
  (is (= #{:status :body :headers} (-> response keys set)))
  (is (= (:status response) 200))
  (is (not (empty? (:body response))))
  (let [json (cheshire/parse-string (:body response) true)]
    (is (not (empty? json)))
    (is (or (map? json)
            (vector? json)))
    (if (map? json)
      (is (= [:template :model :state] (keys json)))
      (is (is-model? (first json)))))
  (is (map? (:headers response)))
  (is ((-> response :headers keys set) "Content-Type")))

(defn test-inaccessible
  [response]
  (is (= [:status :body] (keys response)))
  (is (= (:status response) 403)))

(deftest models-controller-access
  (let [qa (make-role (permissions/mask :read))
        blogger (make-role (permissions/mask :write :read))
        editor (make-role (permissions/mask :write :read :create :delete))
        nobody (make-role 0)
        api models-controller/api]
    (testing "editor-content permissions\n"
      (let [request (:editor-content models-requests)]
        (testing "no perms restricts access to editor content"
          (test-inaccessible (api (request nobody))))
        (testing "read only access to editor-content"
          (test-accessible (api (request qa))))
        (testing "read write access to editor-content"
          (test-accessible (api (request blogger))))
        (testing "full access to editor-content"
        (test-accessible (api (request editor))))))
    (testing "editor-associated-content permissions\n"
      (let [request (:editor-associated-content models-requests)]
        (testing "no perms restricts access to editor-associated-content"
          (test-inaccessible (api (request nobody))))
        (testing "read only access to editor-associated-content"
          (test-accessible (api (request qa))))
        (testing "read write access to editor-associated-content"
          (test-accessible (api (request blogger))))
        (testing "full access to editor-associated-content"
          (test-accessible (api (request editor))))))
    (testing "update-all permissions\n"
      (let [request (:update-all models-requests)]
        (testing "no perms restricts access to update-all"
          (test-inaccessible (api (request nobody))))
        (testing "read only perms restricts access to update-all"
          (test-inaccessible (api (request qa))))
        (testing "read/write perms restricts access to update-all"
          (test-inaccessible (api (request blogger))))
        (testing "create perms allows access to update-all"
          (test-accessible (api (request editor))))))
    (testing "reorder-all permissions\n"
      (let [request (:reorder-all models-requests)
            test-accessible (fn [response]
                              (is (= #{:status :body :headers}
                                     (-> response keys set)))
                              (is (= (:status response) 200))
                              (is (not (empty? (:body response))))
                              (is (map? (:headers response)))
                              (is ((-> response :headers keys set)
                                   "Content-Type"))
                              (is (-> response :body cheshire/parse-string
                                      nil?)))]
        (testing "no perms restricts access to reorder-all"
          (test-inaccessible (api (request nobody))))
        (testing "read only perms restricts access to reorder-all"
          (test-inaccessible (api (request qa))))
        (testing "read-write access to reorder-all"
          (test-accessible (api (request blogger))))
        (testing "create access to reorder-all"
          (test-accessible (api (request editor))))))
    (testing "find-all permissions\n"
      (let [request (:find-all models-requests)]
        (testing "no perms restricts access to find-all"
          (test-inaccessible (api (request nobody))))
        (testing "read only perms allows access to find-all"
          (test-accessible (api (request qa))))
        (testing "read-write access to find-all"
          (test-accessible (api (request blogger))))
        (testing "create access to find-all"
          (test-accessible (api (request editor))))))
    (testing "find-one permissions\n"
      (let [request (:find-one models-requests)
            test-accessible (fn [response]
                              (is (= [:status :body :headers] (keys response)))
                              (is (= (:status response) 200))
                              (is (not (empty? (:body response))))
                              (let [json
                                    (cheshire/parse-string (:body response)
                                                           true)]
                                (is (is-model? json)))
                              (is ((-> response :headers keys set)
                                   "Content-Type")))]
        (testing "no perms restricts access to find-one"
          (test-inaccessible (api (request nobody))))
        (testing "read only perms allows access to find-one"
          (test-accessible (api (request qa))))
        (testing "read-write access to find-one"
          (test-accessible (api (request blogger))))
        (testing "create access to find-one"
          (test-accessible (api (request editor))))))
    (testing "delete-all permissions\n"
      (let [request (:delete-all models-requests)
            test-accessible (fn [response]
                              (is (= 200 (:status response)))
                              (is (= "Delete Me"
                                     (-> response :body
                                         (cheshire/parse-string true)
                                         first :name))))]
        (testing "no perms restricts access to delete-all"
          (test-inaccessible (api (request nobody (rand-int 10000000)))))
        (testing "read only perms restricts access to delete-all"
          (test-inaccessible (api (request qa (rand-int 10000000)))))
        (testing "read-write access restricts access to delete-all"
          (test-inaccessible (api (request blogger (rand-int 10000000)))))
        (testing "full access allows access to delete-all with valid id"
          (model/update :model 1 {:fields [{:name "Delete Me" :type "text"}]})
          (let [field-id (model/models :model :fields :delete-me :row :id)]
            (test-accessible (api (request editor field-id)))))))
    #_(testing "upload-asset permissions\n"
        (let [request (:upload-asset models-requests)
              test-accessible (fn [response]
                                (is (= (#{:status :headers :body}
                                        (-> response keys set))))
                                (is (= 200 (:status response)))
                                (is (= (get (:headers response) "Content-Type")
                                       "application/json"))
                                (is (= "hello.txt"
                                       (-> response :body
                                           (cheshire/parse-string true)
                                           :state :filename))))]
          (testing "no perms restricts access to upload-asset"
            (test-inaccessible (api (request nobody))))
          (testing "read only perms restricts access to upload-asset"
            (test-inaccessible (api (request qa))))
          (testing "read-write access restricts access to upload-asset"
            (test-inaccessible (api (request blogger))))
          (testing "full access allows access to upload-asset"
            (test-accessible (api (request editor))))))
    (testing "remove-link permissions\n"
      (model/init)
      (let [child (model/create :model {:name "Child Delete Me"})
            parent (model/create :model {:name "Parent Delete Me"
                                         :fields [{:name "Child"
                                                   :reciprocal-name "Parent"
                                                   :type "link"
                                                   :target-id (:id child)}]})
            request (fn [id]
                      (let [isaac (model/create (:slug child) {})
                            abraham (model/create (:slug parent)
                                                  {:child [isaac]})]
                        ((:remove-link models-requests)
                         "child" (:id isaac) (:slug parent) (:id abraham) id)))
            test-accessible (fn [response]
                              (is (= #{:status :headers :body}
                                     (-> response keys set)))
                              (is (= 200 (:status response)))
                              (is (= (get (:headers response) "Content-Type")
                                     "application/json"))
                              (is (subset? #{:env-id :position :locked
                                             :updated-at :status-id
                                             :status-position :child-position
                                             :created-at :parent-id :child-id
                                             :parent-position :id}
                                   (-> response
                                       :body
                                       (cheshire/parse-string true)
                                       keys
                                       set))))]
        (testing "no perms restricts access to remove-link"
          (test-inaccessible (api (request nobody))))
        (testing "read only perms restricts access to remove-link"
          (test-inaccessible (api (request qa))))
        (testing "read-write access allows access to remove-link"
          (test-accessible (api (request blogger))))
        (testing "full access allows access to remove-link"
          (test-accessible (api (request editor))))))
    (testing "bulk-editor-content permissions\n"
      (let [ids (map :id (model/gather :model))
            request (partial (:bulk-editor-content models-requests) ids)
            test-accessible (fn [response]
                              (is (= #{:status :headers :body}
                                     (-> response keys set)))
                              (is (= 200 (:status response)))
                              (is (subset? #{:state :inflated :model :template}
                                           (-> response
                                               :body
                                               (cheshire/parse-string true)
                                               keys
                                               set))))]
        (testing "no perms restricts access to bulk-editor-content"
          (test-inaccessible (api (request nobody))))
        ;; TODO : does bulk editor content work in a readonly situation? JS
        (testing "read only perms allows access to bulk-editor-content"
          (test-accessible (api (request qa))))
        (testing "read write access allows access to bulk-editor-content"
          (test-accessible (api (request blogger))))
        (testing "full access allows access to bulk-editor-content"
          (test-accessible (api (request editor))))))))

(defn make-user
  [mask]
  (model/impose :account {:where {:role-id (make-role mask)}}))

(deftest misc-controller-access
  (let [qa (make-user (permissions/mask :read))
        blogger (make-user (permissions/mask :write :read))
        editor (make-user (permissions/mask :write :read :create :delete))
        nobody (make-user 0)]
    (let [request (fn [user]
                    {:params {:search {:content-type "text/plain"}}
                     :session {:admin {:user user}}})
          test-accessible (fn [response]
                            (is (subset? #{:session :status :body}
                                         (set (keys response))))
                            (is (= (:status response) 200))
                            (is (string? (:body response))))]
      (testing "no perms restricts access to matches"
        (test-inaccessible (assets/matches (request nobody))))
      (testing "read only perms allows access to matches"
        (test-accessible (assets/matches (request qa))))
      (testing "read write perms allows access to matches"
        (test-accessible (assets/matches (request blogger))))
      (testing "full perms allows access to matches"
        (test-accessible (assets/matches (request editor)))))
    #_(let [request (fn [user]
                    {:session {:admin {:user user}}})
          test-accessible (fn [response]
                            (is (subset? #{:session :status :body}
                                         (set (keys response))))
                            (is (= (:status response) 200))
                            (is (string? (:body response))))]
      (testing "no perms restricts access to project index"
        (test-inaccessible (projects/index (request nobody)))))))
