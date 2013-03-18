(ns caribou.admin.routes)

(def admin-routes
  ({:path "activity", :children (), :slug "activity", :position nil, :template "", :method "", :action "index", :name "Activity", :controller "activity"}
   {:path "login", :children (), :slug "login", :position nil, :template "login.html", :method "", :action "login", :name "Login", :controller "login"}
   {:path "logout", :children (), :slug "logout", :position nil, :template "logout.html", :method "", :action "logout", :name "Logout", :controller "login"}
   {:path "submit-login", :children (), :slug "submit_login", :position nil, :template "", :method "POST", :action "submit-login", :name "Submit Login", :controller "login"}
   {:path ":site", :slug "subsite", :position nil, :template "", :method "", :action "nothing", :name "Subsite", :controller "login", :children
    ({:path ":locale", :children
      ({:path "dashboard", :children (), :slug "dashboard", :position nil, :template "dashboard/index.html", :method "", :action "index", :name "Dashboard", :controller "dashboard"}
       {:path "content", :children
        ({:path "projects", :children
          ({:path "new", :children (), :slug "new_project", :position nil, :template "content/projects/new.html", :method "", :action "new", :name "New Project", :controller "content.projects"}
           {:path ":id", :children
            ({:path "edit", :children (), :slug "edit_project", :position nil, :template "content/projects/edit.html", :method "", :action "edit", :name "Edit Project", :controller "content.projects"}),
            :slug "view_project", :position nil, :template "content/projects/view.html", :method "", :action "view", :name "View Project", :controller "content.projects"}),
          :slug "projects", :position nil, :template "content/projects/index.html", :method "", :action "index", :name "Projects", :controller "content.projects"}
         {:path "models", :children
          ({:path ":slug", :children (), :slug "view_model", :position nil, :template "content/models/view.html", :method "", :action "view", :name "View Model", :controller "content.models"}
           {:path ":slug/edit", :children (), :slug "edit_model", :position nil, :template "content/models/edit.html", :method "", :action "edit", :name "Edit Model", :controller "content.models"}
           {:path ":slug/new-field", :children (), :slug "new_model_field", :position nil, :template "", :method "POST", :action "new-field", :name "New Model Field", :controller "content.models"}
           {:path ":slug/delete-field", :children (), :slug "delete_model_field", :position nil, :template "", :method "POST", :action "delete-field", :name "Delete Model Field", :controller "content.models"}
           {:path ":slug/results", :children (), :slug "results", :position nil, :template "content/models/instance/results.html", :method "GET", :action "view-results", :name "Results", :controller "content.models"}
           {:path ":slug/create", :children (), :slug "create_model_instance_post", :position nil, :template "content/models/instance/edit.html", :method "POST", :action "create-instance-post", :name "Create Model Instance Post", :controller "content.models"}
           {:path ":slug/create", :children (), :slug "create_model_instance", :position nil, :template "content/models/instance/edit.html", :method "GET", :action "create-instance", :name "Create Model Instance", :controller "content.models"}
           {:path ":slug/:id/edit", :children (), :slug "edit_model_instance_post", :position nil, :template "content/models/instance/edit.html", :method "POST", :action "edit-instance-post", :name "Edit Model Instance Post", :controller "content.models"}
           {:path ":slug/:id/edit", :children (), :slug "edit_model_instance", :position nil, :template "content/models/instance/edit.html", :method "GET", :action "edit-instance", :name "Edit Model Instance", :controller "content.models"}),
          :slug "models", :position nil, :template "content/models/index.html", :method "", :action "index", :name "Models", :controller "content.models"}
         {:path "pages", :children
          ({:path "new", :children (), :slug "new_page", :position nil, :template "content/pages/new.html", :method "", :action "new", :name "New Page", :controller "content.pages"}
           {:path ":id", :children
            ({:path "edit", :children (), :slug "edit_page", :position nil, :template "content/pages/edit.html", :method "", :action "edit", :name "Edit Page", :controller "content.pages"}),
            :slug "view_page", :position nil, :template "content/pages/view.html", :method "", :action "view", :name "View Page", :controller "content.pages"}),
          :slug "pages", :position nil, :template "content/pages/index.html", :method "", :action "index", :name "Pages", :controller "content.pages"}
         {:path "model-api", :children (), :slug "model_api", :position nil, :template "content/models/api.html", :method "", :action "api", :name "Model API", :controller "content.models"}
         {:path "new-model", :children (), :slug "new_model", :position nil, :template "content/model/new.html", :method "", :action "new", :name "New Model", :controller "content.models"}),
        :slug "content", :position nil, :template "", :method "", :action "index", :name "Content", :controller "content"}
       {:path "settings", :children
        ({:path "models", :children (), :slug "model_list", :position nil, :template "settings/model/index.html", :method "", :action "index", :name "Model List", :controller "settings.model"}
         {:path "role_editor/:title", :children (), :slug "edit_roles", :position nil, :template "settings/role_editor.html", :method "", :action "edit-roles", :name "Edit Roles", :controller "roles"}
         {:path "submit-edit-roles/:title", :children (), :slug "submit_edit_roles", :position nil, :template "", :method "POST", :action "submit-edit-roles", :name "Submit Edit Roles", :controller "roles"}
         {:path "accounts", :children
          ({:path "new", :children (), :slug "new_account", :position nil, :template "settings/account/new.html", :method "", :action "new", :name "New Account", :controller "settings.account"}
           {:path "create", :children (), :slug "create_account", :position nil, :template "", :method "POST", :action "create-login", :name "Create Account", :controller "login"}
           {:path ":id", :children
            ({:path "edit", :children (), :slug "edit_account", :position nil, :template "settings/account/edit.html", :method "", :action "edit", :name "Edit Account", :controller "settings.account"}),
            :slug "view_account", :position nil, :template "settings/account/view.html", :method "", :action "view", :name "View Account", :controller "settings.account"}),
          :slug "accounts", :position nil, :template "settings/account/index.html", :method "", :action "index", :name "Accounts", :controller "settings.account"}),
        :slug "settings", :position nil, :template "settings.html", :method "", :action "index", :name "Settings", :controller "settings.model"}),
      :slug "locale", :position nil, :template "", :method "", :action "nothing", :name "Locale", :controller "login"})}
   {:path "forgot-password", :children (), :slug "forgot_password", :position nil, :template "forgot-password.html", :method "", :action "forgot-password", :name "Forgot Password", :controller "login"}))