<template>
  <div class="sql-editor-wrapper">
    <codemirror v-model="sqlCode" :options="editorOptions" ref="codeEditor"></codemirror>
  </div>
</template>

<script>
import { codemirror, CodeMirror } from "vue-codemirror";
import sqlFormatter from "sql-formatter";
_ = require('lodash')
import "codemirror/lib/codemirror.css";
// 语言语法
import "codemirror/mode/sql/sql";
// sql语言提示
import "codemirror/addon/hint/sql-hint.js";

// active-line.js
import "codemirror/addon/selection/active-line.js";

// styleSelectedText
import "codemirror/addon/selection/mark-selection.js";
import "codemirror/addon/search/searchcursor.js";

// 自动提示
import "codemirror/addon/hint/show-hint.js";
import "codemirror/addon/hint/show-hint.css";

// highlightSelectionMatches
import "codemirror/addon/scroll/annotatescrollbar.js";
import "codemirror/addon/search/matchesonscrollbar.js";
import "codemirror/addon/search/searchcursor.js";
import "codemirror/addon/search/match-highlighter.js";
// keyMap
import "codemirror/mode/clike/clike.js";
import "codemirror/keymap/sublime.js";

// foldGutter
import "codemirror/addon/fold/foldgutter.css";
import "codemirror/addon/fold/brace-fold.js";
import "codemirror/addon/fold/comment-fold.js";
import "codemirror/addon/fold/foldcode.js";
import "codemirror/addon/fold/foldgutter.js";
import "codemirror/addon/fold/indent-fold.js";
import "codemirror/addon/fold/markdown-fold.js";
import "codemirror/addon/fold/xml-fold.js";

// theme css
import "codemirror/theme/xq-dark.css";
import "codemirror/theme/xq-light.css";

import { KEYWORDS, FUNCTIONS } from "./editor-box";


// 匹配 （from || join）关键字
const TABLE_SUGGESET_POS_REG = /(^|\s+)(from|join)\s+(\S*)$/i;

// 匹配表名 别名
const TABLES_PATTENS = [
  /\sjoin\s+([\w._`]+)\s*(?:as)?\s*([\w_`]+)?/gi,
  /\sfrom\s+([\w._`]+)\s*(?:as)?\s*([\w_`]+)?/gi
];

export default {
  name: "sqlEditor",
  components: {
    codemirror
  },
  props: {},
  data() {
    return {
      sqlCode: 'select\n' +
              '  distinct userid\n' +
              'from\n' +
              '  tutor.s_tutor_order_tp\n' +
              'where\n' +
              '  datediff(\'2016-08-08\', paiddt) >= 1\n' +
              '  and datediff(\'2016-08-08\', paiddt) <= ？ ？ --过去？天',
      editorOptions: {
        // codemirror options
        tabSize: 4,
        mode: "text/x-mysql",
        theme: "xq-light",
        fullScreen: false,
        lineNumbers: true,
        line: true,
        // 代码折叠
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        // 高级配置（需要引入对应的插件包）,codemirror advanced options(You need to manually introduce the corresponding codemirror function script code)
        // sublime、emacs、vim三种键位模式，支持你的不同操作习惯
        keyMap: "sublime",
        // 按键映射，比如Ctrl键映射autocomplete，autocomplete是hint代码提示事件
        extraKeys: {
          F9: () => {
            this.formatSqlFun();
          },
          "Ctrl-space": "autocomplete"
        },
        showHitObj: null, // 延迟显示联想列表
        currentWord: "", // 关键字记录
        updateTimer: null,
        sqlSuggestList: [],
        // 联想功能
        // hint: （cm) => {
        //   return this.Hint();
        // }
        // hint.js options
        hintOptions: {
          // 当匹配只有一项的时候是否自动补全
          completeSingle: false
        },
        // 联想表名
        sqlSuggestTableNameLists: [],
        // 联想表
        sqlSuggestTableLists: [],
        // 联想列名
        sqlSuggestColumns: [],
        runCur: null
        // 选中文本自动高亮，及高亮方式
        // styleSelectedText: true,
        // highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true },
        // more codemirror options...
        // 如果有hint方面的配置，也应该出现在这里
      }
    };
  },
  computed: {
    codemirror() {
      return this.$refs.codeEditor.codemirror;
    }
  },
  mounted() {
    if (this.$refs.codeEditor) {
      // 绑定键盘事件
      this.$refs.codeEditor.codemirror.on("keyup", this.handleEditorKeyUp);
    }
  },
  destroyed() {},
  methods: {
    // 联想表名
    autocompleteTables(editor) {
      let cur = editor.getCursor();
      let token = this.getToken(editor, cur);
      let word = token.string.toLowerCase();
      let list = [];

      list = this.getSuggestListByRequsest(this.sqlSuggestTableNameLists, word);
      this.hintSort(list, word);
      return {
        list: list,
        from: CodeMirror.Pos(cur.line, token.start),
        to: CodeMirror.Pos(cur.line, token.end)
      };
    },
    // 联想表名|列名处理
    getSuggestListByRequsest(list, word) {
      let listArr = [];
      let map = {};
      for (let i = 0, len = list.length; i < len; i++) {
        let item = list[i].toLowerCase();
        if (item.indexOf(word.trim()) !== -1) {
          // if (word === item) {
          //     continue;
          // }
          if (!map[list[i]]) {
            listArr.push(list[i]);
            map[list[i]] = true;
          }
        }
      }
      return listArr;
    },
    autocompleteColumns(editor) {
      let list = [];
      let cur = editor.getCursor();
      let token = this.getToken(editor, cur);
      let word = token.string.toLowerCase();
      //联想列名
      let sqlSuggestColumns = this.getSuggestListByRequsest(
        this.sqlSuggestColumns,
        word
      );
      list = list.concat(sqlSuggestColumns);
      this.hintSort(list, word);
      list = [...new Set(list)];

      return {
        list: list,
        from: CodeMirror.Pos(cur.line, token.start),
        to: CodeMirror.Pos(cur.line, token.end)
      };
    },
    // 本地关键字联想
    autoComplete(editor) {
      let COMBINED_KEYWORDS = KEYWORDS.concat(FUNCTIONS);
      let cur = editor.getCursor();
      let token = this.getToken(editor, cur);
      let word = token.string.toLowerCase();
      let list = [];
      // let sql = editor.getValue();

      //关键字,函数
      if (word.indexOf(".") < 0) {
        let a = this.getSuggestListByLocal(COMBINED_KEYWORDS, word);
        list = list.concat(a);
      }
      //变量
      if (word.indexOf(".") < 0) {
        if (this.systemVars && this.systemVars.length) {
          let arr = this.getSuggestListByLocal(this.systemVars, word);
          list = list.concat(arr);
        }
      }
      this.hintSort(list, word);
      // if (list.length < 10) { // 加入已经输入的单词联想关键字
      //     let words = sql.split(/[^\w_\u4e00-\u9fa5]/);
      //     let nwords = [];
      //     for (let i = 0; i < words.length; i++) {
      //         if ((!words[i]) || (word === words[i])) {
      //             continue;
      //         }
      //         nwords.push(words[i]);
      //     }
      //     list = list.concat(this.getSuggestListByLocal(nwords, word));
      // }
      list = [...new Set(list)];

      return {
        list: list,
        from: CodeMirror.Pos(cur.line, token.start),
        to: CodeMirror.Pos(cur.line, token.end)
      };
    },
    // 通过关键字 匹配获取suggest列表
    getSuggestListByLocal(list, word) {
      if (word.trim() === "") {
        return [];
      }

      let map = {};
      let listArr = [];
      for (let i = 0, localL = list.length; i < localL; i++) {
        let a = list[i].toLowerCase();
        if (a.indexOf(word.trim()) !== -1) {
          // if (isSelf && (word === a)) {
          //     continue;
          // }
          if (!map[list[i]]) {
            listArr.push(list[i]);
            map[list[i]] = true;
          }
        }
      }

      return listArr;
    },
    hintSort(arr, key) {
      for (let i = 0; i < arr.Length; i++) {
        for (let j = i; j < arr.Length; j++) {
          let a = arr[i].toLowerCase();
          let b = arr[j].toLowerCase();
          if (a.indexOf(key) > b.indexOf(key)) {
            let temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
          }
        }
      }
    },
    formatSqlFun() {
      this.sqlCode = sqlFormatter.format(this.sqlCode, {});
    },
    // 键盘事件监听
    handleEditorKeyUp(editor, e) {
      this.timer && clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        const value = editor.getValue().trim(); // 输入的所有sql
        let cur = editor.getCursor();
        let token = this.getToken(editor, cur);
        let word = token.string.toLowerCase().trim(); // 关键字

        if (
          e.key === "Enter" ||
          e.key === "Tab" ||
          e.key === "Escape" ||
          word === ""
        ) {
          this.currentWord = "";
          return true;
        }
        if (
          this.currentWord === word &&
          (e.key === "ArrowUp" || e.key === "ArrowDown")
        ) {
          return true;
        }
        this.currentWord = word;
        // 复位
        this.sqlSuggestColumns = [];
        this.runCur = cur;
        this.getSuggestData(editor, value, word);
      }, 100);
    },
    // 获取光标的位置
    getToken(e, cur) {
      let t = e.getTokenAt(cur);

      if (
        t.string &&
        (t.string.indexOf(".") >= 0 || t.string.indexOf("$") >= 0)
      ) {
        if (cur.ch > 0) {
          let before = e.getTokenAt({
            line: cur.line,
            ch: t.start
          });
          t.string = (before.string + t.string).trim();
          t.start = before.start;
        }
      }
      return t;
    },
    // execSql() {
    //   let sql =
    //     (this.codemirror && this.codemirror.getSelection()) || this.sqlCode;
    //   let postData = { db: this.db, name: this.sqlName, sql };
    //   console.log(execSql);
    //   execSql(postData).then(data => {
    //     console.log(data);
    //   });
    //   console.log(sql);
    // },
    getSuggestData(editor, value, word) {
      let cur = editor.getCursor();
      // 记录当前查询关键词
      if (word.trim() === "") {
        return;
      }
      let tablesAlias = this.getTablesAndAlias(value);
      let leftValue = editor.getRange({ line: 0, ch: 0 }, cur);
      // if (TABLE_SUGGESET_POS_REG.test(leftValue) && this.dsName) {
      //   // from join 后请求表名
      //   this.getHintTables({ dsName: this.dsName, q: word });
      // } else if (tablesAlias.length && this.dsName) {
      //   // 是否有表 表是否有别名
      //   this.getHintColumns(tablesAlias, word);
      // } else {
      //   this.showSuggestMenu("local"); // 本地联想
      // }
      if (TABLE_SUGGESET_POS_REG.test(leftValue)) {
        // from join 后请求表名
        this.getHintTables();
      } else if (tablesAlias.length) {
        // 是否有表 表是否有别名
        this.getHintColumns(tablesAlias, word);
      } else {
        this.showSuggestMenu('local'); // 本地联想
      }
    },
    getHintTables() {
      this.sqlSuggestTableNameLists = ['aaa','bbb','ccc', 'def', 'table1','table2','table3','table4', 'ghy'];
      this.showSuggestMenu("table");
    },
    getHintColumns(tablesAlias, word) {
      let tables = [];
      let table;
      let body = {};
      let leftWord;
      let idx = word.indexOf(".");
      if (idx !== -1) {
        leftWord = word.substr(0, idx);

        tablesAlias.forEach((item, i) => {
          if (item.alias === leftWord) {
            table = item.name;
          }
        });

        if (table) {
          body.tables = [table];
          this.getColumnList();
        }
      } else {
        tablesAlias.forEach((item, i) => {
          if (item.name !== "") {
            tables.push(item.name);
          }
        });

        tables = [...new Set(tables)];
        body.tables = tables;

        if (tables.length) {
          this.getColumnList({ body });
        }
      }
    },
    getColumnList() {
      this.sqlSuggestColumns = ['user', 'age', 'name', 'id', 'abc', 'efg', 'hij', 'klm', 'nuv', 'wh'];
      this.showSuggestMenu("column");
    },
    // 别名是否合法
    isLegalAlias(alias) {
      let keywords = {
        where: 1,
        on: 1,
        using: 1,
        join: 1,
        group: 1,
        order: 1,
        limit: 1
      };
      return !keywords[alias.toLowerCase()];
    },
    // 拿到sql 输入的所有表和对应的别名
    getTablesAndAlias(sql) {
      let COMBINED_KEYWORDS = KEYWORDS.concat(FUNCTIONS);
      let names = [];
      for (let i = 0; i < TABLES_PATTENS.length; i++) {
        let reg = TABLES_PATTENS[i];
        for (;;) {
          let found = reg.exec(sql);
          if (!found) {
            break;
          }

          reg.lastIndex = found.index + 1;
          let t = found[1];

          let alias = "";
          if (found[2]) {
            alias = found[2].toLowerCase();
            if (!this.isLegalAlias(alias)) {
              alias = "";
            }
          }
          if (COMBINED_KEYWORDS.indexOf(t.toUpperCase()) !== -1) {
            continue;
          }

          names.push({
            name: t,
            alias: alias
          });
        }
      }
      return names;
    },
    showSuggestMenu(type) {
      let autoFn;
      if (this.runCur) {
        let cur = this.codemirror.getCursor();
        if (!_.isEqual(this.runCur, cur)) {
          return;
        }
      }

      if (type == "local") {
        autoFn = this.autoComplete;
      } else if (type == "table") {
        autoFn = this.autocompleteTables;
      } else if (type == "column") {
        autoFn = this.autocompleteColumns;
      }
      if (this.$refs.codeEditor && this.$refs.codeEditor.codemirror) {
        CodeMirror.showHint(this.$refs.codeEditor.codemirror, autoFn);
      }
    }
  }
};
</script>

<style lang="less" scoped>
.sql-editor-wrapper {
  height: 800px;
}
.vue-codemirror {
  height: 100%;
  overflow: hidden;
  /deep/ .CodeMirror {
    height: 100%;
    overflow: auto;
    .CodeMirror-lines {
      padding-top: 6px;
    }
  }
}
</style>