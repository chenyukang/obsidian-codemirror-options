// CodeMirror, copyright (c) by laobubu
// Distributed under an MIT license: http://codemirror.net/LICENSE
//
// This is a patch to markdown mode. Supports lots of new features
//
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };

(function (mod) {
  //[HyperMD] UMD patched!
  /*plain env*/ mod(null, (HyperMD.Mode = HyperMD.Mode || {}), CodeMirror);
})(function (require, exports, CodeMirror) {
  "use strict";
  var _a;
  Object.defineProperty(exports, "__esModule", { value: true });
  /**
   * Markdown Extension Tokens
   *
   * - `$` Maybe a LaTeX
   * - `|` Maybe a Table Col Separator
   */
  var tokenBreakRE = /[^\\][$|]/;
  var listRE = /^(?:[*\-+]|^[0-9]+([.)]))\s+/;
  var urlRE =
    /^((?:(?:aaas?|about|acap|adiumxtra|af[ps]|aim|apt|attachment|aw|beshare|bitcoin|bolo|callto|cap|chrome(?:-extension)?|cid|coap|com-eventbrite-attendee|content|crid|cvs|data|dav|dict|dlna-(?:playcontainer|playsingle)|dns|doi|dtn|dvb|ed2k|facetime|feed|file|finger|fish|ftp|geo|gg|git|gizmoproject|go|gopher|gtalk|h323|hcp|https?|iax|icap|icon|im|imap|info|ipn|ipp|irc[6s]?|iris(?:\.beep|\.lwz|\.xpc|\.xpcs)?|itms|jar|javascript|jms|keyparc|lastfm|ldaps?|magnet|mailto|maps|market|message|mid|mms|ms-help|msnim|msrps?|mtqp|mumble|mupdate|mvn|news|nfs|nih?|nntp|notes|oid|opaquelocktoken|palm|paparazzi|platform|pop|pres|proxy|psyc|query|res(?:ource)?|rmi|rsync|rtmp|rtsp|secondlife|service|session|sftp|sgn|shttp|sieve|sips?|skype|sm[bs]|snmp|soap\.beeps?|soldat|spotify|ssh|steam|svn|tag|teamspeak|tel(?:net)?|tftp|things|thismessage|tip|tn3270|tv|udp|unreal|urn|ut2004|vemmi|ventrilo|view-source|webcal|wss?|wtai|wyciwyg|xcon(?:-userid)?|xfire|xmlrpc\.beeps?|xmpp|xri|ymsgr|z39\.50[rs]?):(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\([^\s()<>]*\))+(?:\([^\s()<>]*\)|[^\s`*!()\[\]{};:'".,<>?«»“”‘’]))/i; // from CodeMirror/mode/gfm
  var emailRE =
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  var url2RE = /^\.{0,2}\/[^\>\s]+/;
  var SimpleTableRE = /^\s*[^\|].*?\|.*[^|]\s*$/;
  var SimpleTableLooseRE = /^\s*[^\|].*\|/; // unfinished | row
  var NormalTableRE = /^\s*\|[^\|]+\|(.+\|)?\s*$/;
  var NormalTableLooseRE = /^\s*\|/; // | unfinished row
  var linkStyle =
    ((_a = {}),
    (_a[1 /* BARELINK */] = "hmd-barelink"),
    (_a[7 /* BARELINK2 */] = "hmd-barelink2"),
    (_a[4 /* WIKILINK */] = "hmd-internal-link"),
    (_a[2 /* FOOTREF */] = "hmd-barelink footref"),
    (_a[5 /* FOOTNOTE */] = "hmd-footnote line-HyperMD-footnote"),
    (_a[8 /* FOOTREF2 */] = "hmd-footref2"),
    (_a[9 /* FOOTREF2 */] = "hmd-embed hmd-internal-link"),
    _a);
  function resetTable(state) {
    state.hmdTable = 0 /* NONE */;
    state.hmdTableColumns = [];
    state.hmdTableID = null;
    state.hmdTableCol = state.hmdTableRow = 0;
  }
  var listInQuoteRE = /^\s+((\d+[).]|[-*+])\s+)?/;
  var defaultTokenTypeOverrides = {
    hr: "line-HyperMD-hr line-background-HyperMD-hr-bg hr",
    // HyperMD needs to know the level of header/indent. using tokenTypeOverrides is not enough
    // header: "line-HyperMD-header header",
    // quote: "line-HyperMD-quote quote",
    // Note: there are some list related process below
    list1: "list-1",
    list2: "list-2",
    list3: "list-3",
    code: "inline-code",
    hashtag: "hashtag meta",
  };
  CodeMirror.defineMode(
    "openmd",
    function (cmCfg, modeCfgUser) {
      var modeCfg = {
        front_matter: true,
        math: true,
        table: true,
        toc: true,
        orgModeMarkup: true,
        hashtag: true,
        fencedCodeBlockHighlighting: true,
        name: "markdown",
        highlightFormatting: true,
        taskLists: true,
        strikethrough: true,
        emoji: false,
        highlight: true,
        tokenTypeOverrides: defaultTokenTypeOverrides,
      };
      Object.assign(modeCfg, modeCfgUser);
      if (modeCfg.tokenTypeOverrides !== defaultTokenTypeOverrides) {
        modeCfg.tokenTypeOverrides = Object.assign({}, defaultTokenTypeOverrides, modeCfg.tokenTypeOverrides);
      }
      modeCfg["name"] = "markdown";
      /** functions from CodeMirror Markdown mode closure. Only for status checking */
      var rawClosure = {
        htmlBlock: null,
      };
      var rawMode = CodeMirror.getMode(cmCfg, modeCfg);
      var newMode = __assign({}, rawMode);
      newMode.startState = function () {
        var ans = rawMode.startState();
        resetTable(ans);
        ans.hmdOverride = null;
        ans.hmdInnerExitChecker = null;
        ans.hmdInnerMode = null;
        ans.hmdLinkType = 0 /* NONE */;
        ans.hmdNextMaybe = modeCfg.front_matter ? 1 /* FRONT_MATTER */ : 0 /* NONE */;
        ans.hmdNextState = null;
        ans.hmdNextStyle = null;
        ans.hmdNextPos = null;
        ans.templater = 0;
        ans.hmdImage = 0;
        ans.hmdHashtag = 0 /* NONE */;
        return ans;
      };
      newMode.copyState = function (s) {
        var ans = rawMode.copyState(s);
        var keys = [
          "hmdLinkType",
          "hmdNextMaybe",
          "hmdTable",
          "hmdTableID",
          "hmdTableCol",
          "hmdTableRow",
          "hmdOverride",
          "hmdInnerMode",
          "hmdInnerStyle",
          "hmdInnerExitChecker",
          "hmdNextPos",
          "hmdNextState",
          "hmdNextStyle",
          "hmdHashtag",
          "hmdImage",
          "templater",
          "comment",
        ];
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
          var key = keys_1[_i];
          ans[key] = s[key];
        }
        ans.hmdTableColumns = s.hmdTableColumns.slice(0);
        if (s.hmdInnerMode) ans.hmdInnerState = CodeMirror.copyState(s.hmdInnerMode, s.hmdInnerState);
        return ans;
      };
      newMode.blankLine = function (state) {
        var ans;
        var innerMode = state.hmdInnerMode;
        if (innerMode) {
          if (innerMode.blankLine) ans = innerMode.blankLine(state.hmdInnerState);
        } else {
          ans = rawMode.blankLine(state);
        }
        if (!ans) ans = "";
        if (state.code === -1) {
          ans += " line-HyperMD-codeblock line-background-HyperMD-codeblock-bg";
        }
        if (state.templater === 1) {
          ans += " line-background-templater-command-bg line-HyperMD-codeblock line-background-HyperMD-codeblock-bg";
        }
        resetTable(state);
        return ans.trim() || null;
      };
      newMode.indent = function (state, textAfter) {
        var mode = state.hmdInnerMode || rawMode;
        var f = mode.indent;
        if (typeof f === "function") return f.apply(mode, arguments);
        return CodeMirror.Pass;
      };
      newMode.innerMode = function (state) {
        if (state.hmdInnerMode) return { mode: state.hmdInnerMode, state: state.hmdInnerState };
        return rawMode.innerMode(state);
      };
      newMode.token = function (stream, state) {
        if (state.hmdOverride) return state.hmdOverride(stream, state);
        if (true) {
          // Only appears once for each Doc
          if (/^<%(.){0,1}$/.test(stream.string) && stream.peek() === "<") {
            state.templater = 1;
            stream.match(/^<%[^\s]*/, true);
            return "templater-opening-tag templater-command formatting line-HyperMD-codeblock formatting-templater line-background-HyperMD-codeblock-bg line-background-HyperMD-codeblock-begin-bg line-background-templater-start line-background-templater-command-bg";
          }
          if (state.templater === 1) {
            return enterMode(stream, state, "javascript", {
              style:
                "templater-command line-HyperMD-codeblock line-background-HyperMD-codeblock-bg line-background-templater-command-bg",
              skipFirstToken: false,
              fallbackMode: function () {
                return createDummyMode("<%");
              },
              exitChecker: function (stream, state) {
                if (/%>$/.test(stream.string)) {
                  // found the endline of front_matter
                  state.templater = -1 /* NONE */;
                  stream.backUp(1);
                  return { endPos: 0 };
                } else {
                  return null;
                }
              },
            });
          }
          if (state.templater === -1) {
            state.templater = 0 /* NONE */;
            stream.skipToEnd();
            return "templater-closing-tag formatting formatting-templater templater-command line-HyperMD-codeblock line-background-HyperMD-codeblock-bg line-background-HyperMD-codeblock-end-bg line-background-templater-end line-background-templater-command-bg";
          } else {
            state.templater = 0 /* NONE */;
          }
        }
        if (state.hmdNextMaybe === 1 /* FRONT_MATTER */) {
          // Only appears once for each Doc
          if (stream.string === "---") {
            state.hmdNextMaybe = 2 /* FRONT_MATTER_END */;
            return enterMode(stream, state, "yaml", {
              style: "hmd-frontmatter",
              fallbackMode: function () {
                return createDummyMode("---");
              },
              exitChecker: function (stream, state) {
                if (stream.string === "---") {
                  // found the endline of front_matter
                  state.hmdNextMaybe = 0 /* NONE */;
                  return { endPos: 3 };
                } else {
                  return null;
                }
              },
            });
          } else {
            state.hmdNextMaybe = 0 /* NONE */;
          }
        }
        var inInternalLink;
        var wasInHTML = state.f === rawClosure.htmlBlock;
        var wasInCodeFence = state.code === -1;
        var bol = stream.start === 0;
        var wasLinkText = state.linkText;
        var wasLinkHref = state.linkHref;
        var inMarkdown = !(wasInCodeFence || wasInHTML);
        var inMarkdownInline = inMarkdown && !(state.code || state.indentedCode || state.linkHref);
        var ans = "";
        var tmp;
        var findComment = null;
        var tmpPOS = -1;
        if (inMarkdown) {
          // now implement some extra features that require higher priority than CodeMirror's markdown
          // add support for headers in list items
          if (/#/.test(stream.peek())) {
            if (state.list && /- (#+)(?: |$)/.test(stream.string)) {
              state.list = false;
              var level = stream.match(/(#+)(?: |$)/, true);
              var depth = level && level.length > 0 ? level[1].length : 0;
              state.header = depth;
              return (ans += "formatting formatting-header formatting-header-" + depth + " header header-" + depth);
            }
          }
          // add support for templater code block syntax
          if ((tmp = stream.match(/^<%/, true))) {
            var endTag_1 = "%>";
            if (stream.string.slice(stream.pos).match(/%>/)) {
              ans = enterMode(stream, state, "javascript", {
                style: "templater-command",
                skipFirstToken: false,
                fallbackMode: function () {
                  return createDummyMode(endTag_1);
                },
                exitChecker: function (stream, state) {
                  const retInfo = {};
                  const endTag = "%>";
                  retInfo.style = "templater-closing-tag formatting formatting-templater line-templater-inline";
                  if (stream.string.substr(stream.start, endTag.length) === endTag) {
                    retInfo.endPos = stream.start + endTag.length;
                    return retInfo;
                  }
                  return null;
                },
              });
              ans += " templater-opening-tag templater-command formatting formatting-templater";
              return ans;
            }
          }
          //#region Math
          if (modeCfg.math && inMarkdownInline && (tmp = stream.match(/^\${1,2}/, false))) {
            var endTag_1 = tmp[0];
            var mathLevel = endTag_1.length;
            if (mathLevel === 2 || stream.string.slice(stream.pos).match(/[^\\\s-]\$(?![0-9])/)) {
              // $$ may span lines, $ must be paired
              var texMode = CodeMirror.getMode(cmCfg, {
                name: "stex",
              });
              var noTexMode = texMode["name"] !== "stex";
              var block = mathLevel > 1 ? "math-block" : "";
              ans += enterMode(stream, state, texMode, {
                style: "math",
                skipFirstToken: noTexMode,
                fallbackMode: function () {
                  return createDummyMode(endTag_1);
                },
                exitChecker: createSimpleInnerModeExitChecker(endTag_1, {
                  style: `formatting formatting-math formatting-math-end ${block} math-` + mathLevel,
                }),
              });
              if (noTexMode) stream.pos += tmp[0].length;
              ans += ` formatting formatting-math formatting-math-begin ${block} math-` + mathLevel;
              return ans;
            }
          }
          //#endregion
          //#region [OrgMode] markup
          if (bol && modeCfg.orgModeMarkup && (tmp = stream.match(/^\#\+(\w+\:?)\s*/))) {
            // Support #+TITLE: This is the title of the document
            if (!stream.eol()) {
              state.hmdOverride = function (stream, state) {
                stream.skipToEnd();
                state.hmdOverride = null;
                return "string hmd-orgmode-markup";
              };
            }
            return "meta formatting-hmd-orgmode-markup hmd-orgmode-markup line-HyperMD-orgmode-markup";
          }
          //#endregion
          //#region [TOC] in a single line
          if (bol && modeCfg.toc && stream.match(/^\[TOCM?\]\s*$/i)) {
            return "meta line-HyperMD-toc hmd-toc";
          }
          //#endregion
          //#region Extra markdown inline extenson
          if (inMarkdownInline) {
            // transform unformatted URL into link
            if (!state.hmdLinkType && (stream.match(urlRE) || stream.match(emailRE))) {
              return "url";
            }
            if (state.internalLink) {
              state.hmdLinkType = 4 /* INTERNAL */;
              state.internalLink = false;
            } else if (state.internalEmbed) {
              state.hmdLinkType = 9 /* EMBED */;
              state.internalEmbed = false;
            } else if ((inInternalLink = stream.match(/^(!?\[\[).+\]\]/, false))) {
              "!" === inInternalLink[1].charAt(0)
                ? ((ans += " formatting-link formatting-link-start formatting-embed"), (state.internalEmbed = true))
                : ((ans += " formatting-link formatting-link-start"), (state.internalLink = true)),
                (tmpPOS = stream.pos + inInternalLink[1].length);
            } else {
              (state.hmdLinkType !== 4 /* INTERNAL */ && state.hmdLinkType !== 9) /* EMBED */ ||
                !stream.match(/^\]\]/, false) ||
                ((state.hmdLinkType = 0) /* NONE */,
                (state.linkText = false),
                (tmpPOS = stream.pos + 2),
                (ans += " formatting-link formatting-link-end"));
            }
            // block refs
            if (stream.match(/^\^([a-zA-Z0-9\-]+)$/)) {
              ans += " blockid";
            }
            // handle comments
            let _pos = stream.pos;
            findComment = function (e) {
              var _match = stream.string.slice(_pos, e).match(/^(.+?)%%/);
              return _match ? _pos + _match[1].length : e;
            };
            if (state.comment) {
              ans += " comment";
              if (stream.match(/^%%/, false)) {
                state.comment = false;
                tmpPOS = stream.pos + 2;
              }
            } else {
              if (stream.match(/^%%/, false)) {
                state.comment = true;
                ans += " comment";
                tmpPOS = stream.pos + 2;
              }
            }
          }
          //#endregion
        }
        // now enter markdown
        if (state.hmdNextState) {
          stream.pos = state.hmdNextPos;
          ans += " " + (state.hmdNextStyle || "");
          Object.assign(state, state.hmdNextState);
          state.hmdNextState = null;
          state.hmdNextStyle = null;
          state.hmdNextPos = null;
        } else {
          ans += " " + (rawMode.token(stream, state) || "");
        }
        if (tmpPOS !== -1) {
          stream.pos = tmpPOS;
        }
        if (findComment) {
          stream.pos = findComment(stream.pos);
        }
        // add extra styles
        if (state.hmdHashtag !== 0 /* NONE */) {
          ans += " " + modeCfg.tokenTypeOverrides.hashtag;
        }
        /** Try to capture some internal functions from CodeMirror Markdown mode closure! */
        if (!rawClosure.htmlBlock && state.htmlState) rawClosure.htmlBlock = state.f;
        var inHTML = state.f === rawClosure.htmlBlock;
        var inCodeFence = state.code === -1;
        inMarkdown = inMarkdown && !(inHTML || inCodeFence);
        inMarkdownInline = inMarkdownInline && inMarkdown && !(state.code || state.indentedCode || state.linkHref);
        // If find a markdown extension token (which is not escaped),
        // break current parsed string into two parts and the first char of next part is the markdown extension token
        if (inMarkdownInline && (tmp = stream.current().match(tokenBreakRE))) {
          stream.pos = stream.start + tmp.index + 1; // rewind
        }
        var current = stream.current();
        if (inHTML != wasInHTML) {
          if (inHTML) {
            ans += " hmd-html-begin";
            rawClosure.htmlBlock = state.f;
          } else {
            ans += " hmd-html-end";
          }
        }
        if (wasInCodeFence || inCodeFence) {
          if (!state.localMode || !wasInCodeFence) ans = ans.replace("inline-code", "");
          ans += " line-HyperMD-codeblock line-background-HyperMD-codeblock-bg hmd-codeblock";
          if (inCodeFence !== wasInCodeFence) {
            if (!inCodeFence) ans += " line-HyperMD-codeblock-end line-background-HyperMD-codeblock-end-bg";
            else if (!wasInCodeFence) ans += " line-HyperMD-codeblock-begin line-background-HyperMD-codeblock-begin-bg";
          }
        }
        if (inMarkdown) {
          var tableType = state.hmdTable;
          //#region [Table] Reset
          if (bol && tableType) {
            var rowRE = tableType == 1 /* SIMPLE */ ? SimpleTableLooseRE : NormalTableLooseRE;
            if (rowRE.test(stream.string)) {
              // still in table
              state.hmdTableCol = 0;
              state.hmdTableRow++;
            } else {
              // end of a table
              resetTable(state);
            }
          }
          //#endregion
          //#region Header, indentedCode, quote

          if (bol && state.header) {
            if (/^(?:---+|===+)\s*$/.test(stream.string) && state.prevLine && state.prevLine.header) {
              ans += " line-HyperMD-header-line line-HyperMD-header-line-" + state.header;
            } else {
              ans += " line-HyperMD-header line-HyperMD-header-" + state.header;
            }
          }
          if (state.indentedCode) {
            ans += " hmd-indented-code";
          }
          if (state.quote) {
            // mess up as less as possible
            if (stream.eol()) {
              ans += " line-HyperMD-quote line-HyperMD-quote-" + state.quote;
              if (!/^ {0,3}\>/.test(stream.string)) ans += " line-HyperMD-quote-lazy"; // ">" is omitted
            }
            if (bol && (tmp = current.match(/^\s+/))) {
              stream.pos = tmp[0].length; // rewind
              ans += " hmd-indent-in-quote";
              return ans.trim();
            }
            // make indentation (and potential list bullet) monospaced
            if (/^>\s+$/.test(current) && stream.peek() != ">") {
              stream.pos = stream.start + 1; // rewind!
              current = ">";
              state.hmdOverride = function (stream, state) {
                stream.match(listInQuoteRE);
                state.hmdOverride = null;
                return "hmd-indent-in-quote line-HyperMD-quote line-HyperMD-quote-" + state.quote;
              };
            }
          }
          //#endregion
          //#region List
          var maxNonCodeIndentation = (state.listStack[state.listStack.length - 1] || 0) + 3;
          var tokenIsIndent =
            bol && /^\s+$/.test(current) && (state.list !== false || stream.indentation() <= maxNonCodeIndentation);
          var tokenIsListBullet = state.list && /formatting-list/.test(ans);
          if (tokenIsListBullet || (tokenIsIndent && (state.list !== false || stream.match(listRE, false)))) {
            var listLevel = (state.listStack && state.listStack.length) || 0;
            if (tokenIsIndent) {
              if (stream.match(listRE, false)) {
                // next token is 1. 2. or bullet
                if (state.list === false) listLevel++;
              } else {
                while (listLevel > 0 && stream.pos < state.listStack[listLevel - 1]) {
                  listLevel--; // find the real indent level
                }
                if (!listLevel) {
                  // not even a list
                  return ans.trim() || null;
                }
                ans += " line-HyperMD-list-line-nobullet line-HyperMD-list-line line-HyperMD-list-line-" + listLevel;
              }
              ans += " hmd-list-indent hmd-list-indent-" + listLevel;
            } else if (tokenIsListBullet) {
              // no space before bullet!
              ans += " line-HyperMD-list-line line-HyperMD-list-line-" + listLevel;
            }
          }
          //#endregion

          //#region Link, BareLink, Footnote, Wikilink etc
          if (stream.current() === "[" && stream.eat("[")) {
            current = "[[";
            // ans += " formatting-link";
          }
          if (stream.current() === "]" && stream.eat("]")) {
            current = "]]";
            // ans += " formatting-link";
          }
          if (wasLinkText !== state.linkText) {
            if (!wasLinkText) {
              if (current === "[[" || current === "]]") {
                // Check wiki link
                state.hmdLinkType = 4 /* WIKILINK */;
              } else {
                // entering a link
                tmp = stream.match(/^([^\]]+)\](\(| ?\[|\:)?/, false);
                if (!tmp) {
                  // maybe met a line-break in link text?
                  state.hmdLinkType = 1 /* BARELINK */;
                } else if (!tmp[2]) {
                  // barelink
                  if (tmp[1].charAt(0) === "^") {
                    state.hmdLinkType = 2 /* FOOTREF */;
                  } else {
                    state.hmdLinkType = 1 /* BARELINK */;
                  }
                } else if (tmp[2] === ":") {
                  // footnote
                  state.hmdLinkType = 5 /* FOOTNOTE */;
                } else if (
                  (tmp[2] === "[" || tmp[2] === " [") &&
                  stream.string.charAt(stream.pos + tmp[0].length) === "]"
                ) {
                  // [barelink2][]
                  state.hmdLinkType = 7 /* BARELINK2 */;
                } else {
                  state.hmdLinkType = 3 /* NORMAL */;
                }
              }
            } else {
              // leaving a link
              if (state.hmdLinkType in linkStyle) {
                if (current !== "[[" && current !== "]]") {
                  ans += " " + linkStyle[state.hmdLinkType];
                }
              }
              if (state.hmdLinkType === 5 /* FOOTNOTE */) {
                state.hmdLinkType = 6 /* MAYBE_FOOTNOTE_URL */;
              } else {
                state.hmdLinkType = 0 /* NONE */;
              }
            }
          }
          if (wasLinkHref !== state.linkHref) {
            if (!wasLinkHref) {
              // [link][doc] the [doc] part
              if (current === "[" && stream.peek() !== "]") {
                state.hmdLinkType = 8 /* FOOTREF2 */;
              }
            } else if (state.hmdLinkType) {
              // leaving a Href
              ans += " " + linkStyle[state.hmdLinkType];
              state.hmdLinkType = 0 /* NONE */;
            }
          }
          if (state.hmdLinkType !== 0 /* NONE */) {
            if (state.hmdLinkType in linkStyle) {
              if (current !== "[[" && current !== "]]") {
                ans += " " + linkStyle[state.hmdLinkType];
              }
            }
            if (
              (state.hmdLinkType === 4 || state.hmdLinkType === 9) /* WIKILINK */ &&
              current !== "[[" &&
              current !== "]]"
            ) {
              var eaten = false;
              // break out of link if templater syntax found
              if (stream.match(/^<%/, false)) {
                return;
              }
              while (stream.eat(/[^<|\]#]/)) {
                eaten = true;
              }
              if (stream.eat("%")) {
                stream.backUp(2);
                return;
              }
              if (eaten || (stream.peek() || "").match(/[\|\]#]/)) {
                if (stream.peek() === "#") {
                  // link has a ref
                  if (stream.match(/[^|\]]+\|[^\]]+\]\]/, false)) {
                    // link has an alias
                    ans += " " + "internal-link-url";
                  } else {
                    // no alias
                    ans += " " + "internal-link-name";
                  }
                } else if (stream.current().startsWith("#")) {
                  stream.eat("|");
                  ans += " " + "internal-link-ref";
                } else if (stream.peek() === "|") {
                  stream.eat("|");
                  // console.log(current);
                  if (/\.(jpe?g|png|gif|svg|bmp)/.test(stream.current())) {
                    state.hmdImage = 1;
                    ans += " " + "internal-link-name hmd-image";
                  } else {
                    ans += " " + "internal-link-url";
                  }
                } else if (!stream.current().startsWith("#")) {
                  if (state.hmdImage === 1) {
                    state.hmdImage = 0;
                    ans += " " + "internal-link-url";
                  } else {
                    ans += " " + "internal-link-name";
                  }
                } else {
                  // ans += " " + "internal-link-ref";
                }
                current = stream.current();
              }
            }
            if (state.hmdLinkType === 6 /* MAYBE_FOOTNOTE_URL */) {
              if (!/^(?:\]\:)?\s*$/.test(current)) {
                // not spaces
                if (urlRE.test(current) || url2RE.test(current)) ans += " hmd-footnote-url";
                else ans = ans.replace("string url", "");
                state.hmdLinkType = 0 /* NONE */; // since then, can't be url anymore
              }
            }
          }
          //#endregion
          //#region start of an escaped char
          if (/formatting-escape/.test(ans) && current.length > 1) {
            // CodeMirror merge backslash and escaped char into one token, which is not good
            // Use hmdOverride to separate them
            var escapedLength_1 = current.length - 1;
            var escapedCharStyle_1 = ans.replace("formatting-escape", "escape") + " hmd-escape-char";
            state.hmdOverride = function (stream, state) {
              // one-time token() func
              stream.pos += escapedLength_1;
              state.hmdOverride = null;
              return escapedCharStyle_1.trim();
            };
            ans += " hmd-escape-backslash";
            stream.pos -= escapedLength_1;
            return ans;
          }
          //#endregion
          //#region [Table] Creating Table and style Table Separators
          if (!ans.trim() && modeCfg.table) {
            // string is unformatted
            var isTableSep = false;
            if (current.charAt(0) === "|") {
              // is "|xxxxxx", separate "|" and "xxxxxx"
              stream.pos = stream.start + 1; // rewind to end of "|"
              current = "|";
              isTableSep = true;
            }
            if (isTableSep) {
              // if not inside a table, try to construct one
              if (!tableType) {
                // check 1: current line meet the table format
                if (SimpleTableRE.test(stream.string)) tableType = 1 /* SIMPLE */;
                else if (NormalTableRE.test(stream.string)) tableType = 2 /* NORMAL */;
                // check 2: check every column's alignment style
                var rowStyles = void 0;
                if (tableType) {
                  var nextLine = stream.lookAhead(1);
                  if (tableType === 2 /* NORMAL */) {
                    if (!NormalTableRE.test(nextLine)) {
                      tableType = 0 /* NONE */;
                    } else {
                      // remove leading / tailing pipe char
                      nextLine = nextLine.replace(/^\s*\|/, "").replace(/\|\s*$/, "");
                    }
                  } else if (tableType === 1 /* SIMPLE */) {
                    if (!SimpleTableRE.test(nextLine)) {
                      tableType = 0 /* NONE */;
                    }
                  }
                  if (tableType) {
                    rowStyles = nextLine.split("|");
                    for (var i = 0; i < rowStyles.length; i++) {
                      var row = rowStyles[i];
                      if (/^\s*--+\s*:\s*$/.test(row)) row = "right";
                      else if (/^\s*:\s*--+\s*$/.test(row)) row = "left";
                      else if (/^\s*:\s*--+\s*:\s*$/.test(row)) row = "center";
                      else if (/^\s*--+\s*$/.test(row)) row = "default";
                      else {
                        // ouch, can't be a table
                        tableType = 0 /* NONE */;
                        break;
                      }
                      rowStyles[i] = row;
                    }
                  }
                }
                // step 3: made it
                if (tableType) {
                  // successfully made one
                  state.hmdTable = tableType;
                  state.hmdTableColumns = rowStyles;
                  state.hmdTableID = "T" + stream.lineOracle?.line;
                  state.hmdTableRow = state.hmdTableCol = 0;
                }
              }
              // then
              if (tableType) {
                var _dummy = false;
                var colUbound = state.hmdTableColumns.length - 1;
                if (
                  tableType === 2 /* NORMAL */ &&
                  ((state.hmdTableCol === 0 && /^\s*\|$/.test(stream.string.slice(0, stream.pos))) ||
                    stream.match(/^\s*$/, false))
                ) {
                  _dummy = true;
                  ans += " hmd-table-sep hmd-table-sep-dummy";
                }
                if (state.hmdTableCol <= colUbound) {
                  var row = state.hmdTableRow;
                  var col = state.hmdTableCol++;
                  if (col == 0) {
                    ans +=
                      " line-HyperMD-table_" +
                      state.hmdTableID +
                      " line-HyperMD-table-" +
                      tableType +
                      " line-HyperMD-table-row line-HyperMD-table-row-" +
                      row;
                  }
                  if (!_dummy) ans += " hmd-table-sep hmd-table-sep-" + col;
                }
              }
            }
          }
          //#endregion
          if (tableType && state.hmdTableRow === 1) {
            // fix a stupid problem:    :------: is not emoji
            if (/emoji/.test(ans)) ans = "";
          }
          //#region HTML Block
          //
          // See https://github.github.com/gfm/#html-blocks type3-5
          if (inMarkdownInline && current === "<") {
            var endTag = null;
            if (stream.match(/^\![A-Z]+/)) endTag = ">";
            else if (stream.match("?")) endTag = "?>";
            else if (stream.match("![CDATA[")) endTag = "]]>";
            if (endTag != null) {
              return enterMode(stream, state, null, {
                endTag: endTag,
                style: (ans + " comment hmd-cdata-html").trim(),
              });
            }
          }
          //#endregion
          //#region Hashtag
          if (modeCfg.hashtag && inMarkdownInline) {
            const hashTagRegExp = /^(?:[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s])+/;
            if (state.hmdHashtag === 1) {
              var endHashTag = false;
              if (!/formatting/.test(ans) && !/^\s*$/.test(current)) {
                stream.eatWhile(hashTagRegExp);
                endHashTag = true;
              }
              if (
                (endHashTag || (endHashTag = stream.eol()),
                endHashTag || (endHashTag = !hashTagRegExp.test(stream.peek())),
                endHashTag)
              ) {
                ans +=
                  " hashtag-end " + (tagClass = "tag-" + (tagClass = stream.current()).replace(/[^_a-zA-Z0-9\-]/g, ""));
                state.hmdHashtag = 0;
              }
            } else if (
              "#" === current &&
              !state.linkText &&
              !state.image &&
              (bol || /^\s*$/.test(stream.string.charAt(stream.start - 1)))
            ) {
              var escape_removed_str = stream.string.slice(stream.pos).replace(/\\./g, "");
              tmp = hashTagRegExp.exec(escape_removed_str);
              if (tmp && /[^0-9]/.test(tmp[0])) {
                var tagClass = "tag-" + tmp[0].replace(/[^_a-zA-Z0-9\-]/g, "");
                state.hmdHashtag = 1;
                ans +=
                  " formatting formatting-hashtag hashtag-begin " + modeCfg.tokenTypeOverrides.hashtag + " " + tagClass;
              }
            }
          }
          //#endregion
        }
        return ans.trim() || null;
      };
      function modeOverride(stream, state) {
        var exit = state.hmdInnerExitChecker(stream, state);
        var extraStyle = state.hmdInnerStyle;
        var ans = ((!exit || !exit.skipInnerMode) && state.hmdInnerMode.token(stream, state.hmdInnerState)) || "";
        if (extraStyle) ans += " " + extraStyle;
        if (exit) {
          if (exit.style) ans += " " + exit.style;
          if (exit.endPos) stream.pos = exit.endPos;
          state.hmdInnerExitChecker = null;
          state.hmdInnerMode = null;
          state.hmdInnerState = null;
          state.hmdOverride = null;
        }
        return ans.trim() || null;
      }
      /**
       * advance Markdown tokenizing stream
       *
       * @returns true if success, then `state.hmdNextState` & `state.hmdNextStyle` will be set
       */
      function advanceMarkdown(stream, state) {
        if (stream.eol() || state.hmdNextState) return false;
        var oldStart = stream.start;
        var oldPos = stream.pos;
        stream.start = oldPos;
        var newState = __assign({}, state);
        var newStyle = rawMode.token(stream, newState);
        state.hmdNextPos = stream.pos;
        state.hmdNextState = newState;
        state.hmdNextStyle = newStyle;
        // console.log("ADVANCED!", oldStart, oldPos, stream.start, stream.pos)
        // console.log("ADV", newStyle, newState)
        stream.start = oldStart;
        stream.pos = oldPos;
        return true;
      }
      function createDummyMode(endTag) {
        return {
          token: function (stream) {
            var endTagSince = stream.string.indexOf(endTag, stream.start);
            if (endTagSince === -1) stream.skipToEnd();
            // endTag not in this line
            else if (endTagSince === 0) stream.pos += endTag.length;
            // current token is endTag
            else {
              stream.pos = endTagSince;
              if (stream.string.charAt(endTagSince - 1) === "\\") stream.pos++;
            }
            return null;
          },
        };
      }
      function createSimpleInnerModeExitChecker(endTag, retInfo) {
        if (!retInfo) retInfo = {};
        return function (stream, state) {
          if (stream.string.substr(stream.start, endTag.length) === endTag) {
            retInfo.endPos = stream.start + endTag.length;
            return retInfo;
          }
          return null;
        };
      }
      /**
       * switch to another mode
       *
       * After entering a mode, you can then set `hmdInnerExitStyle` and `hmdInnerState` of `state`
       *
       * @returns if `skipFirstToken` not set, returns `innerMode.token(stream, innerState)`, meanwhile, stream advances
       */
      function enterMode(stream, state, mode, opt) {
        if (typeof mode === "string") mode = CodeMirror.getMode(cmCfg, mode);
        if (!mode || mode["name"] === "null") {
          if ("endTag" in opt) mode = createDummyMode(opt.endTag);
          else mode = typeof opt.fallbackMode === "function" && opt.fallbackMode();
          if (!mode) throw new Error("no mode");
        }
        state.hmdInnerExitChecker = "endTag" in opt ? createSimpleInnerModeExitChecker(opt.endTag) : opt.exitChecker;
        state.hmdInnerStyle = opt.style;
        state.hmdInnerMode = mode;
        state.hmdOverride = modeOverride;
        state.hmdInnerState = CodeMirror.startState(mode);
        var ans = opt.style || "";
        if (!opt.skipFirstToken) {
          ans += " " + mode.token(stream, state.hmdInnerState);
        }
        return ans.trim();
      }
      return newMode;
    },
    "openmd"
  );
  CodeMirror.defineMIME("text/x-openmd", "openmd");
});
