<template>
  <div
    id="app"
    class="h-screen flex flex-col font-sans overflow-hidden antialiased"
    :dir="languageDirection"
    :language="language"
  >
    <WindowsTitleBar
      v-if="platform === 'Windows'"
      :db-path="dbPath"
      :company-name="companyName"
    />

    <!-- Main Contents -->
    <Desk
      v-if="activeScreen === 'Desk'"
      class="flex-1"
      @change-db-file="showDbSelector"
    />
    <DatabaseSelector
      v-if="activeScreen === 'DatabaseSelector'"
      ref="databaseSelector"
      @new-database="newDatabase"
      @file-selected="fileSelected"
    />
    <SetupWizard
      v-if="activeScreen === 'SetupWizard'"
      @setup-complete="setupComplete"
      @setup-canceled="showDbSelector"
    />
    <Modal :openModal="showRegModal" @closemodal="closeRegModal">
      <Register @register-complete="handleRegSuccess" @register-canceled="closeRegModal"/>
    </Modal>
    <!-- Login Modal -->
    <Modal :openModal="showLoginModal" >
      <Login @login-success="handleLoginSuccess" @login-failed="closeLoginModalErr"/>
    </Modal>
    
    <!-- Render target for toasts -->
    <div
      id="toast-container"
      class="absolute bottom-0 flex flex-col items-end mb-3 pe-6"
      style="width: 100%; pointer-events: none"
    ></div>
  </div>
</template>

<script lang="ts">
import { RTL_LANGUAGES } from "fyo/utils/consts";
import { ModelNameEnum } from "models/types";
import { systemLanguageRef } from "src/utils/refs";
import { defineComponent, provide, ref, Ref, getCurrentInstance } from "vue";
import WindowsTitleBar from "./components/WindowsTitleBar.vue";
import { handleErrorWithDialog } from "./errorHandling";
import { fyo } from "./initFyo";
import DatabaseSelector from "./pages/DatabaseSelector.vue";
import Desk from "./pages/Desk.vue";
import SetupWizard from "./pages/SetupWizard/SetupWizard.vue";
import setupInstance from "./setup/setupInstance";
import { SetupWizardOptions } from "./setup/types";
import "./styles/index.css";
import { connectToDatabase, dbErrorActionSymbols } from "./utils/db";
import { initializeInstance } from "./utils/initialization";
import * as injectionKeys from "./utils/injectionKeys";
import { showDialog } from "./utils/interactive";
import { setLanguageMap } from "./utils/language";
import { updateConfigFiles } from "./utils/misc";
import { updatePrintTemplates } from "./utils/printTemplates";
import { Search } from "./utils/search";
import { Shortcuts } from "./utils/shortcuts";
import { routeTo } from "./utils/ui";
import { useKeys } from "./utils/vueUtils";
import Login from "./pages/Auth/Login.vue";
import Register from "./pages/Auth/Register.vue";
import Modal from "./components/Modal.vue";

enum Screen {
  Desk = "Desk",
  DatabaseSelector = "DatabaseSelector",
  SetupWizard = "SetupWizard",
  
}

export default defineComponent({
  name: "App",
  components: {
    Desk,
    SetupWizard,
    DatabaseSelector,
    WindowsTitleBar,
    Login,
    Register,
    Modal,
  },
  setup() {
    const keys = useKeys();
    const searcher: Ref<null | Search> = ref(null);
    const shortcuts = new Shortcuts(keys);
    const languageDirection = ref(getLanguageDirection(systemLanguageRef.value));
    const showLoginModal = ref(false);
    const showRegModal = ref(false);

    provide(injectionKeys.keysKey, keys);
    provide(injectionKeys.searcherKey, searcher);
    provide(injectionKeys.shortcutsKey, shortcuts);
    provide(injectionKeys.languageDirectionKey, languageDirection);

    const databaseSelector = ref<InstanceType<typeof DatabaseSelector> | null>(null);

    return {
      keys,
      searcher,
      shortcuts,
      languageDirection,
      databaseSelector,
      showLoginModal,
      showRegModal,
    };
  },
  data() {
    return {
      activeScreen: null,
      dbPath: "",
      companyName: "",
      password: "",
    } as {
      activeScreen: null | Screen;
      dbPath: string;
      companyName: string;
      password: string;
    };
  },
  computed: {
    language(): string {
      return systemLanguageRef.value;
    },
  },
  watch: {
    language(value: string) {
      this.languageDirection = getLanguageDirection(value);
    },
  },
  async mounted() {
    await this.setInitialScreen();
  },
  methods: {
    async setInitialScreen(): Promise<void> {
      const lastSelectedFilePath = fyo.config.get("lastSelectedFilePath", null);

      if (typeof lastSelectedFilePath !== "string" || !lastSelectedFilePath.length) {
        this.activeScreen = Screen.DatabaseSelector;
        return;
      }

      await this.fileSelected(lastSelectedFilePath);
    },
    async setSearcher(): Promise<void> {
      this.searcher = new Search(fyo);
      await this.searcher.initializeKeywords();
    },
    async setDesk(filePath: string): Promise<void> {
      this.dbPath = filePath; // Set dbPath for future reference
      
      
      await this.initializeDesk(filePath);
    },
    async initializeDesk(filePath: string): Promise<void> {
      await setLanguageMap();
      this.activeScreen = Screen.Desk;
      await this.setDeskRoute();
      await fyo.telemetry.start(true);
      await ipc.checkForUpdates();
      this.companyName = (await fyo.getValue(
        ModelNameEnum.AccountingSettings,
        "companyName"
      )) as string;
      await this.setSearcher();
      updateConfigFiles(fyo);
    },
    newDatabase() {
      this.activeScreen = Screen.SetupWizard;
    },
    async fileSelected(filePath: string): Promise<void> {
      fyo.config.set("lastSelectedFilePath", filePath);
      if (filePath !== ":memory:" && !(await ipc.checkDbAccess(filePath))) {
        await showDialog({
          title: this.t`Cannot open file`,
          type: "error",
          detail: this.t`Frappe Books does not have access to the selected file: ${filePath}`,
        });
        fyo.config.set("lastSelectedFilePath", null);
        return;
      }
      if (filePath.endsWith('.enc')) {
        this.dbPath = filePath;
        this.openLoginModal();
        return;
      }

      try {
        await this.showSetupWizardOrDesk(filePath);
      } catch (error) {
        await handleErrorWithDialog(error, undefined, true, true);
        await this.showDbSelector();
      }
    },
    async setupComplete(setupWizardOptions: SetupWizardOptions): Promise<void> {
      const companyName = setupWizardOptions.companyName;
      const filePath = await ipc.getDbDefaultPath(companyName);
      await setupInstance(filePath, setupWizardOptions, fyo);
      fyo.config.set("lastSelectedFilePath", filePath);
      console.log("Encripting : ..");
      await this.openRegModal();
      
    },
    async showSetupWizardOrDesk(filePath: string): Promise<void> {

      const { countryCode, error, actionSymbol } = await connectToDatabase(this.fyo, filePath);

      if (!countryCode && error && actionSymbol) {
        return await this.handleConnectionFailed(error, actionSymbol);
      }

      const setupComplete = await fyo.getValue(ModelNameEnum.AccountingSettings, "setupComplete");

      if (!setupComplete) {
        this.activeScreen = Screen.SetupWizard;
        return;
        
      }
      
      
      await initializeInstance(filePath, false, countryCode, fyo);
      await updatePrintTemplates(fyo);
      await this.setDesk(filePath); // Check for login and show desk accordingly
    },
    async handleConnectionFailed(error: Error, actionSymbol: symbol) {
      await this.showDbSelector();

      if (actionSymbol === dbErrorActionSymbols.CancelSelection) {
        return;
      }

      if (actionSymbol === dbErrorActionSymbols.SelectFile) {
        await this.databaseSelector?.existingDatabase();
        return;
      }

      throw error;
    },
    async setDeskRoute(): Promise<void> {
      const { onboardingComplete } = await fyo.doc.getDoc("GetStarted");
      const { hideGetStarted } = await fyo.doc.getDoc("SystemSettings");

      let route = "/get-started";
      if (hideGetStarted || onboardingComplete) {
        route = localStorage.getItem("lastRoute") || "/";
      }

      await routeTo(route);
    },
    async showDbSelector(): Promise<void> {
      localStorage.clear();
      fyo.config.set("lastSelectedFilePath", null);
      fyo.telemetry.stop();
      await fyo.purgeCache();
      this.activeScreen = Screen.DatabaseSelector;
      this.dbPath = "";
      this.searcher = null;
      this.companyName = "";
    },

    //Login Section
    openLoginModal() {
      this.showLoginModal = true;
    },

    
    async closeLoginModalErr() {
      this.showLoginModal = false;
      
      await this.showDbSelector();
    },

    async openRegModal() {
      this.showRegModal = true;
      
    },

    async closeRegModal() {
      this.showRegModal = false;
      fyo.config.set("lastSelectedFilePath", null); // Set lastSelectedFilePath to null

      await this.setInitialScreen();
    },

    async handleRegSuccess(payload: { doc: any; password: string }) {
  
      this.showRegModal = false;
      this.password = payload.password;
      const filePath=fyo.config.config.get("lastSelectedFilePath") as string;;
      if (this.password!=""){
        try {
        const result = await ipc.encript(filePath,this.password)
        if (result.success) {
          console.log('File encrypted successfully:', result.encryptedFilePath);
        } else {
          console.error('File encryption failed:', result.error);
        }
      } catch (error) {
        console.error('An error occurred during encryption:', error);
      }
      finally{
        this.password=''
      }
      
      }
      
      await this.initializeDesk(filePath);
      
    },
     async handleLoginSuccess(payload: { doc: any; password: string; filePath: string }) {
      this.showLoginModal = false;
      try {
        await this.showSetupWizardOrDesk(payload.filePath);
      } catch (error) {
        await handleErrorWithDialog(error, undefined, true, true);
        await this.showDbSelector();
      }
}
}
});

function getLanguageDirection(language: string): "rtl" | "ltr" {
  return RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";
}
</script>
