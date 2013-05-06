(ns caribou-admin.test.model-permissions
  (:require [clojure
             [test :as test :refer [deftest testing is]]
             [set :as set :refer [intersection subset?]]]
            [cheshire.core :as cheshire]
            [caribou
             [model :as model]
             [config :as config]
             [permissions :as permissions]]
            [caribou.admin.hooks :as hooks]
            [caribou.admin.controllers.content.models :as models-controller]))

(def requests
  {; :editor-for {} ;; deprecated?
   :editor-content {:params
                    {:site "admin",
                     :locale "global",
                     :action "editor-content",
                     :locale-code "",
                     :model "page"}}
   :editor-associated-content {:params
                               {:site "admin",
                                :locale "global",
                                :action "editor-associated-content",
                                :field "siphons",
                                :page "0",
                                :template "_paged_collection.html",
                                :id "1",
                                :model "page"}}
   :update-all {:json-params {"data" [{"model" "page",
                                       "fields" {"route",
                                                 "invalid"},
                                       "opts" {}}]}
                :params {:site "admin",
                         :locale "global",
                         :action "update-all"}}
   :reorder-all {:params
                 {:site "admin",
                  :locale "global"
                  :action "reorder-all"}
                 :json-params
                 {"data" {"model" "page",
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
                           {"id" "292", "position" 9}]}}}
   :find-all {:params
              {:site "admin",
               :locale "global",
               :action "find-all",
               :model "page"}}
   :find-one {:params
              {:site "admin",
               :locale "global",
               :action "find-one",
               :slug "page",
               :include "fields",
               :model "page"}}
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
               :slug "page",
               :page "admin.results"}}
   :upload-asset {}
   :remove-link {}
   :reindex {}
   :bulk-editor-content {}})

(defn cleanup
  [old-roles old-pages]
  (let [roles (map :id (model/gather :role))
        pages (map :id (model/gather :page))]
    (doseq [id (remove old-roles roles)]
      (model/destroy :role id))
    (doseq [id (remove old-pages pages)]
      (model/destroy :page id))))

(defn do-caribou
  [f]
  (config/init)
  (model/init)
  (hooks/init)
  (model/db
   (fn []
     (let [existing-roles (set (map :id (model/gather :role)))
           existing-pages (set (map :id (model/gather :page)))]
       (f)
       (cleanup existing-roles existing-pages)))))

(test/use-fixtures :once do-caribou)

(deftest itemize-by
  (is (= {0 {:a 0 :b 1} 1 {:a 1 :b 1}}
         (models-controller/itemize-by :a [{:a 0 :b 1} {:a 1 :b 1}]))))

(defn make-user
  [mask]
  (let [{role-id :id} (model/impose :role {:where {:default_mask mask}})]
    role-id))

(deftest inflate-request
  (let [admin (make-user (permissions/mask :write :read :create :delete))
        dummy (make-user 0)
        request (fn [role-id]
                  {:params {:locale ""}
                   :session {:admin {:user {:role_id role-id}}}})
        inflated (models-controller/inflate-request (request dummy))] 
    (is (= [:permissions :locale :params :session] (keys inflated)))
    (is (= #{0} (set (map (comp :mask second) (:permissions inflated)))))))

(deftest has-perms
  (let [admin (make-user (permissions/mask :write :read :delete :create))
        qa (make-user (permissions/mask :read))
        dummy (make-user 0)
        all-permissions models-controller/all-permissions
        has-perms models-controller/has-perms]
    (is (has-perms 1 (all-permissions admin)
                    [:read :write :delete :create] admin))
    (is (not (has-perms 1 (all-permissions dummy)
                        [:read :write :delete :create] dummy)))
    (is (not (has-perms 1 nil [:read :write :delete :create] nil)))
    (is (not (has-perms 1 (all-permissions nil)
                        [:read :write :delete :create] nil)))
    (is (has-perms 1 (all-permissions qa) [:read] qa))
    (is (not (has-perms 1 (all-permissions qa) [:write] qa)))
    (is (not (has-perms 1 (all-permissions qa) [:create] qa)))
    (is (not (has-perms 1 (all-permissions qa) [:delete] qa)))))

(defn test-accessible
  [response]
  (is (= [:status :body :headers] (keys response)))
  (is (= (:status response) 200))
  (is (not (empty? (:body response))))
  (let [json (cheshire/parse-string (:body response) true)]
    (is (not (empty? json)))
    (is (or (map? json)
            (vector? json)))
    (if (map? json)
      (is (= [:template :model :state] (keys json)))
      (is (subset?  #{:slug :env_id :position :protected :name :locked
                      :updated_at :status_id :status_position :created_at :id}
                    (-> json first keys set)))))
  (is (map? (:headers response)))
  (is ((-> response :headers keys set) "Content-Type")))

(defn test-inaccessible
  [response]
  (is (= [:status :body] (keys response)))
  (is (= (:status response) 403)))

(deftest access
  (let [qa (make-user (permissions/mask :read))
        blogger (make-user (permissions/mask :write :read))
        editor (make-user (permissions/mask :write :read :create :delete))
        nobody (make-user 0)
        api models-controller/api]
    (testing "editor-content permissions"
      (let [request (fn [id]
                      (assoc (:editor-content requests)
                        :session {:admin {:user {:role_id id}}}))]
        (testing "no perms restricts access to editor content"
          (test-inaccessible (api (request nobody))))
        (testing "read only restricts access to editor-content"
          (test-inaccessible (api (request qa))))
        (testing "read write access to editor-content"
          (test-accessible (api (request blogger))))
        (testing "full access to editor-content"
        (test-accessible (api (request editor))))))
    (testing "editor-associated-content permissions"
      (let [request (fn [id]
                      (assoc (:editor-associated-content requests)
                        :session {:admin {:user {:role_id id}}}))]
        (testing "no perms restricts access to editor-associated-content"
          (test-inaccessible (api (request nobody))))
        (testing "read only restricts access to editor-associated-content"
          (test-inaccessible (api (request qa))))
        (testing "read write access to editor-associated-content"
          (test-accessible (api (request blogger))))
        (testing "full access to editor-associated-content"
          (test-accessible (api (request editor))))))
    (testing "update-all permissions\n"
      (let [request (fn [id]
                      (assoc (:update-all requests)
                        :session {:admin {:user {:role_id id}}}))]
        (testing "no perms restricts access to update-all"
          (test-inaccessible (api (request nobody))))
        (testing "read only perms restricts access to update-all"
          (test-inaccessible (api (request qa))))
        (testing "read/write perms restricts access to update-all"
          (test-inaccessible (api (request blogger))))
        (testing "create perms allows access to update-all"
          (test-accessible (api (request editor))))))
    (testing "reorder-all permissions\n"
      (let [request (fn [id]
                      (assoc (:reorder-all requests)
                        :session {:admin {:user {:role_id id}}}))]))))
