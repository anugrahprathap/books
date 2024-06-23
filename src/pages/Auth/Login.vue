<template>
  <div class="flex flex-col justify-center items-center">
    <h2 class="mt-4 font-bold">Login</h2>
    <CommonFormSection
      v-for="([name, fields], idx) in activeGroup.entries()"
      :key="name + idx"
      ref="formSections"
      class="p-4 w-full max-w-md"
      :class="idx !== 0 && activeGroup.size > 1 ? 'border-t' : ''"
      :show-title="activeGroup.size > 1 && name !== t('Default')"
      :title="name"
      :fields="fields"
      :doc="doc"
      :errors="errors"
      :collapsible="false"
      @value-change="onValueChange"
    />
    <div class="mt-1 mb-2 flex">
      <Button
        type="primary"
        class="w-24"
        data-testid="submit-button"
        :disabled="!areAllValuesFilled || loading"
        @click="submit"
      >{{ t`Login` }}</Button>
      <Button
        type="secondary"
        class="w-24 ml-2"
        data-testid="cancel-button"
        @click="cancel"
      >{{ t`Cancel` }}</Button>
    </div>
  </div>
</template>

<script lang="ts">
import CommonFormSection from '../CommonForm/CommonFormSection.vue';
import { defineComponent, computed } from 'vue';
import { Field } from 'schemas/types';
import { Doc } from 'fyo/model/doc';
import { getFieldsGroupedByTabAndSection } from 'src/utils/ui';
import { getSetupAuthDoc } from 'src/utils/misc';
import { t, TranslationString } from 'fyo/utils/translation';
import { DocValue } from 'fyo/core/types';
import { getErrorMessage } from 'src/utils';
import { showDialog } from 'src/utils/interactive';
import { Verb } from 'fyo/telemetry/types';
import { ModelNameEnum } from 'models/types';
import Button from 'src/components/Button.vue';
import { userLogin } from 'models/baseModels/Auth/auth';
import { Fyo } from 'fyo';

export default defineComponent({
  name: 'Login',
  fyo: Fyo,
  components: {
    CommonFormSection,
    Button,
  },
  provide() {
    return {
      doc: computed(() => this.docOrNull),
    };
  },
  emits: ['login-success', 'login-failed'],
  data() {
    return {
      docOrNull: null,
      errors: {},
      loading: false,
    } as {
      errors: Record<string, string>;
      docOrNull: null | Doc;
      loading: boolean;
    };
  },
  computed: {
    hasDoc(): boolean {
      return this.docOrNull instanceof Doc;
    },
    doc(): Doc {
      if (this.docOrNull instanceof Doc) {
        return this.docOrNull;
      }
      throw new Error(t`Doc is null`);
    },
    areAllValuesFilled(): boolean {
      if (!this.hasDoc) {
        return false;
      }
      const values = this.doc.schema.fields
        .filter((f) => f.required)
        .map((f) => this.doc[f.fieldname]);
      return values.every(Boolean);
    },
    activeGroup(): Map<string, Field[]> {
      if (!this.hasDoc) {
        return new Map();
      }
      const groupedFields = getFieldsGroupedByTabAndSection(
        this.doc.schema,
        this.doc
      );
      return [...groupedFields.values()][0];
    },
  },
  async mounted() {
    const languageMap = TranslationString.prototype.languageMap;
    this.docOrNull = getSetupAuthDoc(languageMap);
    if (!this.fyo.db.isConnected) {
      await this.fyo.db.init();
    }
  },
  methods: {
    async onValueChange(field: Field, value: DocValue) {
      if (!this.hasDoc) {
        return;
      }
      const { fieldname } = field;
      delete this.errors[fieldname];
      try {
        await this.doc.set(fieldname, value);
      } catch (err) {
        if (!(err instanceof Error)) {
          return;
        }
        this.errors[fieldname] = getErrorMessage(err, this.doc);
      }
    },
    async showErrorDialog(title: string, detail: string) {
      return await showDialog({
        title: this.t`${title}`,
        detail: this.t`${detail}`,
        type: `error`,
      });
      
    },
    async submit() {
      if (!this.hasDoc) {
        return;
      }
      if (!this.areAllValuesFilled) {
        return await this.showErrorDialog('Mandatory Error', 'Please fill all values.');
      }
      this.loading = true;
      try {
        const data = await userLogin(ModelNameEnum.Login, this.doc.getValidDict(), this.fyo);
        if (data) {
          this.$emit('login-success', this.doc.getValidDict());
        } else {
          this.$emit('login-failed');
          return await this.showErrorDialog(`Invalid Username or Password`, `Please check your credentials and try again.`);
        }
      } catch (err) {
        return await this.showErrorDialog(`Unexpected Error`, `An error occurred during login. Please try again later.`);
      } finally {
        this.loading = false;
      }
    },
    cancel() {
      this.fyo.telemetry.log(Verb.Cancelled, ModelNameEnum.Login);
      this.$emit('login-failed');
    },
  },
});
</script>
