(defproject caribou-admin "0.1.0"
  :description "The page routing ring handler for caribou"
  :dependencies [[org.clojure/clojure "1.3.0"]
                 [antler/caribou-frontend "0.9.5"]
                 [hiccup "1.0.2"]
                 [antler/lichen "0.3.1"]
                 [clj-stacktrace "0.2.5"]
                 [swank-clojure "1.4.2" :exclusions [clj-stacktrace]]
                 [clj-time "0.4.4"]
                 [org.mindrot/jbcrypt "0.3m"]]
  :jvm-opts ["-agentlib:jdwp=transport=dt_socket,server=y,suspend=n" "-Xmx4g"]
  :source-paths ["src" "../src"]
  :resource-paths ["resources/" "../resources/"]
  :ring {:handler caribou.admin.core/handler
         :servlet-name "caribou-admin"
         :init caribou.admin.core/init
         :open-browser? false
         :port 33663})
