<template>
  <div id="app">
    <sql-editor></sql-editor>
  </div>
</template>

<script>
import SqlEditor from './component/sqlEditor.vue';
export default {
  components: {
    SqlEditor
  }
}
</script>
<style lang="less">
#app {
  background-color: #f5f5f5;
  height: 100%;
}
</style>
