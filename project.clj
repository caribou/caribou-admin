(defproject antler/caribou-admin "0.10.5"
  :description "Generic admin tool for Caribou projects"
  :dependencies [[org.clojure/clojure "1.4.0"]
                 [antler/caribou-frontend "0.10.1"]
                 [antler/lichen "0.3.3"]
                 [swank-clojure "1.4.2" :exclusions [clj-stacktrace]]
                 [clj-time "0.4.4"]]
  :jvm-opts ["-agentlib:jdwp=transport=dt_socket,server=y,suspend=n" "-Xmx2g"]
  :source-paths ["src" "../src"]
  :resource-paths ["resources/" "../resources/"]
  :ring {:handler caribou.admin.core/handler
         :servlet-name "caribou-admin"
         :init caribou.admin.core/init
         :open-browser? false
         :port 33773})
