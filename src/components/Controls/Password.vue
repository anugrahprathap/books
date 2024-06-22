<script lang="ts">
import { defineComponent } from 'vue';
import Data from './Data.vue';

export default defineComponent({
  name: 'Password',
  extends: Data,
  computed: {
    inputType() {
      return 'password';
    },
  },
  
});
</script>
