<template>
  <nav class="bg-white-800">
    <div class="container">
      <div class="flex items-center  py-4">
        <ul class="flex justify-evenly border-b">
          <div v-for="group in groups" :key="group.label">
            <Dropdown
              class="-mb-px mr-2 divide-x"
              v-if="group.items && group.items.length"
              :items="convertToDropdownItems(group.items)"
              :is-loading="isLoading"
            >
              <template #default="{ toggleDropdown }">
                <Button
                  @click="toggleDropdown()"
                  class="flex items-center bg-white  py-2 px-4 hover:text-blue-800"
                  :class="{
                    'border-l border-t border-r rounded-t text-blue-700 font-semibold': isGroupActive(
                      group
                    ),
                  }"
                >
                  <!-- Custom trigger button content -->
                  <span>{{ group.label }}</span>
                  <feather-icon name="chevron-down" class="w-4 h-4 ml-1" />
                </Button>
              </template>
            </Dropdown>
            <button
              v-else
              @click="routeToSidebarItem(group)"
              class="-mb-px mr-2 bg-white inline-block py-2 px-4 hover:text-blue-800 divide-x"
              :class="{
                'border-l border-t border-r rounded-t py-2 px-4 text-blue-700 font-semibold': isGroupActive(
                  group
                ),
              }"
            >
              {{ group.label }}
            </button>

            <!-- {{ group.label }} -->
          </div>

          <!-- Add more menu items as needed -->
        </ul>
      </div>
    </div>
  </nav>
</template>

<script lang="ts">
import { reportIssue } from "src/errorHandling";
import { languageDirectionKey, shortcutsKey } from "src/utils/injectionKeys";
import { docsPathRef } from "src/utils/refs";
import { getSidebarConfig } from "src/utils/sidebarConfig";
import { SidebarConfig, SidebarItem, SidebarRoot } from "src/utils/types";
import { routeTo, toggleSidebar } from "src/utils/ui";
import { defineComponent, inject } from "vue";
import router from "../router";
import Icon from "./Icon.vue";
import Modal from "./Modal.vue";
import ShortcutsHelper from "./ShortcutsHelper.vue";
import Dropdown from "./Dropdown.vue";
import { DropdownItem } from "src/utils/types";
import DropdownWithActions from "./DropdownWithActions.vue";

const COMPONENT_NAME = "NavBar";
export default defineComponent({
  name: "NavBar",
  components: {
    Icon,
    Modal,
    ShortcutsHelper,
    Dropdown,
    DropdownWithActions,
  },
  emits: ["change-db-file"],
  setup() {
    return {
      languageDirection: inject(languageDirectionKey),
      shortcuts: inject(shortcutsKey),
    };
  },
  data() {
    return {
      companyName: "",
      groups: [],
      viewShortcuts: false,
      activeGroup: null,
      showDevMode: false,
      isLoading: false,

      dropdownItem: [],
    } as {
      companyName: string;
      groups: SidebarConfig;
      viewShortcuts: boolean;
      activeGroup: null | SidebarRoot;
      showDevMode: boolean;
      isLoading: boolean;
      dropdownItem: DropdownItem[];
    };
  },

  async mounted() {
    this.groups = await getSidebarConfig();

    this.setActiveGroup();
    router.afterEach(() => {
      this.setActiveGroup();
    });

    this.shortcuts?.shift.set(COMPONENT_NAME, ["KeyH"], () => {
      if (document.body === document.activeElement) {
        this.toggleSidebar();
      }
    });
    this.shortcuts?.set(COMPONENT_NAME, ["F1"], () => this.openDocumentation());

    this.showDevMode = this.fyo.store.isDevelopment;
  },
  unmounted() {
    this.shortcuts?.delete(COMPONENT_NAME);
  },
  methods: {
    routeTo,
    reportIssue,
    toggleSidebar,
    openDocumentation() {
      ipc.openLink("https://docs.frappebooks.com/" + docsPathRef.value);
    },
    convertToDropdownItems(items: SidebarItem[]): DropdownItem[] {
      return items.map((item) => {
        const dropdownItem: DropdownItem = {
          label: item.label,
          action: () => this.routeToSidebarItem(item),
        };

        return dropdownItem;
      });
    },

    setActiveGroup() {
      const { fullPath } = this.$router.currentRoute.value;
      const fallBackGroup = this.activeGroup;
      this.activeGroup =
        this.groups.find((g) => {
          if (fullPath.startsWith(g.route) && g.route !== "/") {
            return true;
          }

          if (g.route === fullPath) {
            return true;
          }

          if (g.items) {
            let activeItem = g.items.filter(
              ({ route }) => route === fullPath || fullPath.startsWith(route)
            );

            if (activeItem.length) {
              return true;
            }
          }
        }) ??
        fallBackGroup ??
        this.groups[0];
    },
    isItemActive(item: SidebarItem) {
      const { path: currentRoute, params } = this.$route;
      const routeMatch = currentRoute === item.route;

      const schemaNameMatch = item.schemaName && params.schemaName === item.schemaName;

      const isMatch = routeMatch || schemaNameMatch;
      if (params.name && item.schemaName && !isMatch) {
        return currentRoute.includes(`${item.schemaName}/${params.name}`);
      }

      return isMatch;
    },
    isGroupActive(group: SidebarRoot) {
      return this.activeGroup && group.label === this.activeGroup.label;
    },
    routeToSidebarItem(item: SidebarItem | SidebarRoot) {
      routeTo(this.getPath(item));
    },
    getPath(item: SidebarItem | SidebarRoot) {
      const { route: path, filters } = item;
      if (!filters) {
        return path;
      }

      return { path, query: { filters: JSON.stringify(filters) } };
    },
  },
});
</script>

<style></style>
