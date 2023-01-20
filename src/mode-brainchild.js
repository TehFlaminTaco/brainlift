/*eslint-disable*/
ace.define("ace/mode/brainchild", function (require, exports, module) {
  var oop = require("ace/lib/oop");
  var TextMode = require("ace/mode/text").Mode;
  var BrainChildHighlightRules =
    require("ace/mode/brainchild_highlight_rules").BrainChildHighlightRules;

  var Mode = function () {
    this.HighlightRules = BrainChildHighlightRules;
  };
  oop.inherits(Mode, TextMode);

  exports.Mode = Mode;
});

ace.define(
  "ace/mode/brainchild_highlight_rules",
  function (require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextHighlightRules =
      require("./text_highlight_rules").TextHighlightRules;

    var BrainChildHighlightRules = function () {
      var keywords =
        "any|asm|class|else|func|function|if|int|label|metamethod|return|static|void|while";

      var functions =
        // builtinFunctions
        "write";

      var keywordMapper = this.createKeywordMapper(
        {
          keyword: keywords,
          "support.function": functions,
        },
        "identifier"
      );

      var decimalInteger =
        "(?:0*(?:0|6[0-5][0-5][0-3][0-5]|[1-5][0-9][0-9][0-9][0-9]|[1-9][0-9]{0,3}))";
      var hexInteger = "(?:0[xX][\\dA-Fa-f]{1,4})";
      var badDecimal = "(?:\\d+)";
      var badHex = "(?:0x[xX][\\dA-Fa-f]+)";
      var integer = "(?:" + decimalInteger + "|" + hexInteger + ")";
      var badInteger = "(?:" + badDecimal + "|" + badHex + ")";

      this.$rules = {
        start: [
          {
            token: "comment",
            regex: /\/\*/,
            next: [
              {
                token: "comment",
                regex: /\*\//,
                next: "start",
              },
              {
                defaultToken: "comment",
              },
            ],
          },

          {
            token: "comment",
            regex: "//.*$",
          },
          {
            token: "string", // " string
            regex: '"(?:[^\\\\]|\\\\.)*?"',
          },
          {
            token: "string.char", // ' char
            regex: /'\\?.'/,
          },
          {
            token: "constant.numeric", // integer
            regex: integer + "\\b",
          },
          {
            token: "invalid.number",
            regex: badInteger + "\\b",
          },
          {
            token: keywordMapper,
            regex: "[a-zA-Z_$][a-zA-Z0-9_$]*\\b",
          },
          {
            token: "keyword", // pre-compiler directives
            regex: "#\\s*(?:include|import|pragma|line|define|undef)\\b",
            next: "directive",
          },
          {
            token: "keyword", // special case pre-compiler directive
            regex: "#\\s*(?:endif|if|ifdef|else|elif|ifndef)\\b",
          },
          {
            token: "keyword.operator",
            regex:
              "\\+|\\-|\\*|\\/|%|\\^|~|<|>|<=|=>|==|~=|=|\\:|\\.\\.\\.|\\.\\.",
          },
          {
            token: "paren.lparen",
            regex: "[\\[\\(\\{]",
          },
          {
            token: "paren.rparen",
            regex: "[\\]\\)\\}]",
          },
          {
            token: "text",
            regex: "\\s+|\\w+",
          },
        ],
        directive: [
          {
            token: "constant.other.multiline",
            regex: /\\/,
          },
          {
            token: "constant.other.multiline",
            regex: /.*\\/,
          },
          {
            token: "constant.other",
            regex: "\\s*<.+?>",
            next: "start",
          },
          {
            token: "constant.other", // single line
            regex: '\\s*["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]',
            next: "start",
          },
          {
            token: "constant.other", // single line
            regex: "\\s*['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']",
            next: "start",
          },
          // "\" implies multiline, while "/" implies comment
          {
            token: "constant.other",
            regex: /[^\\\/]+/,
            next: "start",
          },
        ],
      };

      this.normalizeRules();
    };

    oop.inherits(BrainChildHighlightRules, TextHighlightRules);

    exports.BrainChildHighlightRules = BrainChildHighlightRules;
  }
);
