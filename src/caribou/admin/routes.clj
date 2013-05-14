(ns caribou.admin.routes)

(def admin-routes
  [{:path "forgot-password", :children [], :slug "admin.forgot-password",
    :position nil, :template "forgot-password.html", :method "",
    :action "forgot-password", :name "Forgot Password",
    :controller "settings.account"}
   {:path "activity", :children [], :slug "admin.activity", :position nil,
    :template "", :method "", :action "index", :name "Activity",
    :controller "activity"}
   {:path "login", :children [], :slug "admin.login", :position nil,
    :template "login.html", :method "", :action "login", :name "Login",
    :controller "settings.account"}
   {:path "logout", :children [], :slug "admin.logout", :position nil,
    :template "logout.html", :method "", :action "logout", :name "Logout",
    :controller "settings.account"}
   {:path "submit-login", :children [], :slug "admin.submit-login",
    :position nil, :template "", :method "POST", :action "submit-login",
    :name "Submit Login", :controller "settings.account"}
   {:path ":site", :slug "admin.subsite", :position nil, :template "",
    :method "", :action "nothing", :name "Subsite", :controller "admin.settings",
    :children
    [{:path ":locale", :slug "admin.locale", :position nil, :template "",
      :method "", :action "nothing", :name "Locale",
      :controller "settings.account"
      :children
      [{:path "dashboard", :children [], :slug "admin.dashboard", :position nil,
        :template "dashboard/index.html", :method "", :action "index",
        :name "Dashboard", :controller "dashboard"}
       {:path "content", :slug "admin.content", :position nil, :template "",
        :method "", :action "index", :name "Content", :controller "content"
        :children
        [{:path "projects", :slug "admin.projects", :position nil,
          :template "content/projects/index.html", :method "", :action "index",
          :name "Projects", :controller "content.projects"
          :children
          [{:path "new", :children [], :slug "admin.new-project", :position nil,
            :template "content/projects/new.html", :method "", :action "new",
            :name "New Project", :controller "content.projects"}
           {:path ":id", :slug "admin.view-project", :position nil,
            :template "content/projects/view.html", :method "", :action "view",
            :name "View Project", :controller "content.projects"},
           :children
            [{:path "edit", :children [], :slug "admin.edit-project",
              :position nil, :template "content/projects/edit.html",
              :method "", :action "edit", :name "Edit Project",
              :controller "content.projects"}]]}
         {:path "models", :slug "admin.models", :position nil,
          :template "content/models/index.html", :method "", :action "index",
          :name "Models", :controller "content.models",
          :children
          [{:path ":slug", :children [], :slug "admin.view-model",
            :position nil, :template "content/models/view.html", :method "",
            :action "view", :name "View Model", :controller "content.models"}
           {:path ":slug/edit", :children [], :slug "admin.edit-model",
            :position nil, :template "content/models/edit.html", :method "",
            :action "edit", :name "Edit Model", :controller "content.models"}
           {:path ":slug/new-field", :children [], :slug "admin.new-model-field",
            :position nil, :template "", :method "POST", :action "new-field",
            :name "New Model Field", :controller "content.models"}
           {:path ":slug/delete-field", :children [],
            :slug "admin.delete-model-field", :position nil, :template "",
            :method "POST", :action "delete-field", :name "Delete Model Field",
            :controller "content.models"}
           {:path ":slug/results", :children [], :slug "admin.results",
            :position nil, :template "content/models/instance/results.html",
            :method "GET", :action "view-results", :name "Results",
            :controller "content.models"}
           {:path ":slug/create", :children [],
            :slug "admin.create-model-instance-post", :position nil,
            :template "content/models/instance/edit.html", :method "POST",
            :action "create-instance-post", :name "Create Model Instance Post",
            :controller "content.models"}
           {:path ":slug/create", :children [],
            :slug "admin.create-model-instance", :position nil,
            :template "content/models/instance/edit.html", :method "GET",
            :action "create-instance", :name "Create Model Instance",
            :controller "content.models"}
           {:path ":slug/:id/edit", :children [],
            :slug "admin.edit-model-instance-post", :position nil,
            :template "content/models/instance/edit.html", :method "POST",
            :action "edit-instance-post", :name "Edit Model Instance Post",
            :controller "content.models"}
           {:path ":slug/:id/edit", :children [],
            :slug "admin.edit-model-instance", :position nil,
            :template "content/models/instance/edit.html", :method "GET",
            :action "edit-instance", :name "Edit Model Instance",
            :controller "content.models"}]}
         {:path "pages", :slug "admin.pages", :position nil,
          :template "content/pages/index.html", :method "", :action "index",
          :name "Pages", :controller "content.pages"
          :children
          [{:path "new", :children [], :slug "admin.new-page", :position nil,
            :template "content/pages/new.html", :method "", :action "new",
            :name "New Page", :controller "content.pages"}
           {:path ":id", :slug "admin.view-page", :position nil,
            :template "content/pages/view.html", :method "", :action "view",
            :name "View Page", :controller "content.pages"
            :children
            [{:path "edit", :children [], :slug "admin.edit-page",
              :position nil, :template "content/pages/edit.html", :method "",
              :action "edit", :name "Edit Page", :controller "content.pages"}]}]}
         {:path "model-api", :children [], :slug "admin.model-api", :position nil
          :template "content/models/api.html", :method "", :action "api",
          :name "Model API", :controller "content.models"}
         {:path "new-model", :children [], :slug "admin.new-model", :position nil
          :template "content/model/new.html", :method "", :action "new",
          :name "New Model", :controller "content.models"}]}
       {:path "settings", :slug "admin.settings", :position nil,
        :template "settings.html", :method "", :action "index", :name
        "Settings", :controller "settings.model"
        :children
        [{:path "models", :children [], :slug "admin.model-list", :position nil,
          :template "settings/model/index.html", :method "", :action "index",
          :name "Model List", :controller "settings.model"}
         {:path "role-editor/:title", :children [], :slug "admin.edit-roles",
          :position nil, :template "settings/role_editor.html", :method "",
          :action "edit-roles", :name "Edit Roles", :controller "roles"}
         {:path "submit-edit-roles/:title", :children [],
          :slug "admin.submit-edit-roles", :position nil, :template "",
          :method "POST", :action "submit-edit-roles", :name "Submit Edit Roles",
          :controller "roles"}
         {:path "accounts", :slug "admin.accounts", :position nil,
          :template "settings/account/index.html", :method "",
          :action "index", :name "Accounts", :controller "settings.account"
          :children
          [{:path "new", :children [], :slug "admin.new-account", :position nil,
            :template "settings/account/new.html", :method "", :action "new",
            :name "New Account", :controller "settings.account"}
           {:path "create", :children [], :slug "admin.create-account",
            :position nil, :template "", :method "POST", :action "create",
            :name "Create Account", :controller "settings.account"}
           {:path ":id", :slug "admin.view-account", :position nil,
            :template "settings/account/view.html", :method "", :action "view",
            :name "View Account", :controller "settings.account",
            :children
            [{:path "edit", :children [], :slug "admin.edit-account",
              :position nil, :template "settings/account/edit.html", :method "",
              :action "edit", :name "Edit Account",
              :controller "settings.account"}]}]}]}]}]}])
