(defproject caribou/caribou-admin "0.12.16"
  :description "Generic admin tool for Caribou projects"
  :dependencies [[org.clojure/clojure "1.5.1"]
                 [caribou/caribou-frontend "0.12.14"]
                 [clj-time "0.4.4"]]
  :jvm-opts ["-agentlib:jdwp=transport=dt_socket,server=y,suspend=n"
             "-Djava.awt.headless=true"
             "-Xmx2g"]
  :source-paths ["src" "../src"]
  :resource-paths ["resources/" "../resources/"]
  :ring {:handler caribou.admin.core/handler
         :servlet-name "caribou-admin"
         :init caribou.admin.core/init
         :open-browser? false
         :port 33773})
