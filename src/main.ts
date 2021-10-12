/* eslint-disable @typescript-eslint/ban-ts-comment */
import { ObsidianCodeMirrorOptionsSettings, ObsidianCodeMirrorOptionsSettingsTab } from "./settings";
import "./runmode";
import "./colorize";
import "./mark-selection";
import "./active-line";

import "./hmd-core";
import "./hmd-click";
import "./hmd-hide-token";
import "./hmd-mode";
import "./hmd-fold";
import "./hmd-fold-link";
import "./hmd-fold-image";
import "./hmd-table-align";

import { onRenderLine } from "./container-attributes";
import { DEFAULT_SETTINGS } from "./settings";
import { MarkdownView, MarkdownPreviewRenderer, Plugin, EditorPosition, debounce } from "obsidian";
import type codemirror from "codemirror";
import { EditorConfiguration } from "codemirror";

declare module "codemirror" {
  // These typescript definitions were pulled from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/codemirror
  // I couldn't get the direct TS imports of these working without having the entire CodeMirror library ending up in main.js

  interface StyleActiveLine {
    /**
     * Controls whether single-line selections, or just cursor selections, are styled. Defaults to false (only cursor selections).
     */
    nonEmpty: boolean;
  }
  interface LineHandle {
    text: string;
    lineNo: () => number;
    styleClasses: { textClass: string };
    styles: any[];
    markedSpans: string | any[];
    stateAfter: { listStack: string | any[] };
  }
  interface TextMarker {
    lines: any;
  }
  interface EditorConfiguration {
    /**
     * If set to true (the default), will keep the cursor height constant for an entire line (or wrapped part of a line).
     * When false, the cursor's height is based on the height of the adjacent reference character.
     */
    singleCursorHeightPerLine?: boolean;
    /**
     * Causes the selected text to be marked with the CSS class CodeMirror-selectedtext or a custom class when the styleSelectedText option is enabled.
     * Useful to change the colour of the selection (in addition to the background).
     */
    styleSelectedText?: boolean | string | undefined;
    hmdClick?: boolean | string | undefined;
    hmdFold?: any;
    hmdHideToken?: boolean | string | undefined;
    hmdTableAlign?: boolean | string | undefined;
    /**
     * When enabled gives the wrapper of the line that contains the cursor the class CodeMirror-activeline,
     * adds a background with the class CodeMirror-activeline-background, and adds the class CodeMirror-activeline-gutter to the line's gutter space is enabled.
     */
    styleActiveLine?: StyleActiveLine | boolean | undefined;
  }
  interface Editor extends Doc {
    foldCode(pos: EditorPosition, options, force: string): void;
    breakMark(cm: CodeMirror.Editor, marker: CodeMirror.MarkerRange, chOffset?: number): void;
    editor: CodeMirror.Editor;
    marker: CodeMirror.MarkerRange;
  }
  function colorize(collection?: ArrayLike<Element>, defaultMode?: string, showLineNums?: boolean): void;
}

export default class ObsidianCodeMirrorOptionsPlugin extends Plugin {
  settings: ObsidianCodeMirrorOptionsSettings;

  async onload() {
    // load settings
    await this.loadSettings();

    // add the settings tab
    this.addSettingTab(new ObsidianCodeMirrorOptionsSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.registerCodeMirrorSettings();
      this.applyBodyClasses();

      setTimeout(() => {
        // workaround to ensure our plugin registers properly with Style Settings
        this.app.workspace.trigger("css-change");
      }, 1000);
    });
    this.registerCommands();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  registerCommands() {
    this.addCommand({
      id: "toggle-openmd",
      name: "Toggle OpenMD Mode",
      callback: () => {
        this.settings.enableOpenMD = !this.settings.enableOpenMD;
        this.saveData(this.settings);
        this.updateCodeMirrorOption("mode", this.settings.enableOpenMD ? "openmd" : "hypermd");
      },
    });
    this.addCommand({
      id: "toggle-hide-tokens",
      name: "Toggle Hide Markdown Tokens",
      callback: () => {
        this.settings.editModeHideTokens = !this.settings.editModeHideTokens;
        this.saveData(this.settings);
        this.updateCodeMirrorOption("hmdHideToken", this.settings.editModeHideTokens ? this.settings.tokenList : false);
        this.applyBodyClasses();
      },
    });
    this.addCommand({
      id: "toggle-click-handler",
      name: "Toggle Edit Mode Click Handler",
      callback: () => {
        this.settings.editModeClickHandler = !this.settings.editModeClickHandler;
        this.saveData(this.settings);
        this.updateCodeMirrorOption("hmdClick", this.settings.editModeClickHandler);
      },
    });
    this.addCommand({
      id: "toggle-collapse-links",
      name: "Toggle Collapse External Links",
      callback: () => {
        this.settings.foldLinks = !this.settings.foldLinks;
        this.saveData(this.settings);
        this.updateCodeMirrorOption(
          "hmdFold",
          !this.settings.foldImages && !this.settings.foldLinks
            ? false
            : {
                image: this.settings.foldImages,
                link: this.settings.foldLinks,
              }
        );
      },
    });
    this.addCommand({
      id: "toggle-render-images-inline",
      name: "Toggle Render Images Inline",
      callback: () => {
        this.settings.foldImages = !this.settings.foldImages;
        this.saveData(this.settings);
        this.applyBodyClasses();
        this.updateCodeMirrorOption(
          "hmdFold",
          !this.settings.foldImages && !this.settings.foldLinks
            ? false
            : {
                image: this.settings.foldImages,
                link: this.settings.foldLinks,
              }
        );
      },
    });
    this.addCommand({
      id: "toggle-container-attributes",
      name: "Toggle Container Attributes",
      callback: () => {
        this.settings.containerAttributes = !this.settings.containerAttributes;
        this.saveData(this.settings);
        this.updateCodeMirrorHandlers("renderLine", onRenderLine, this.settings.containerAttributes, true);
      },
    });
    this.addCommand({
      id: "toggle-dynamic-cursor-size",
      name: "Toggle Dynamic Cursor Size",
      callback: () => {
        this.settings.dynamicCursor = !this.settings.dynamicCursor;
        this.saveData(this.settings);
        this.updateCodeMirrorOption("singleCursorHeightPerLine", !this.settings.dynamicCursor);
      },
    });
    this.addCommand({
      id: "toggle-style-active-selection",
      name: "Toggle Style Active Selection",
      callback: () => {
        this.settings.markSelection = !this.settings.markSelection;
        this.saveData(this.settings);
        this.updateCodeMirrorOption("styleSelectedText", this.settings.markSelection);
        this.applyBodyClasses();
      },
    });
    this.addCommand({
      id: "toggle-retain-active-line",
      name: "Toggle Retain Active Line on Selection",
      callback: () => {
        this.settings.activeLineOnSelect = !this.settings.activeLineOnSelect;
        this.saveData(this.settings);
        this.updateCodeMirrorOption("styleActiveLine", this.settings.activeLineOnSelect ? { nonEmpty: true } : true);
      },
    });
    this.addCommand({
      id: "toggle-edit-mode-syntax",
      name: "Toggle Edit Mode Syntax Highlighting",
      callback: () => {
        this.settings.syntaxHighlighting = !this.settings.syntaxHighlighting;
        this.saveData(this.settings);
        this.applyBodyClasses(true);
      },
    });
    this.addCommand({
      id: "toggle-preview-mode-syntax",
      name: "Toggle Preview Mode Syntax Highlighting",
      callback: () => {
        this.settings.enablePrismJSStyling = !this.settings.enablePrismJSStyling;
        this.saveData(this.settings);
        this.applyBodyClasses(true);
      },
    });
    this.addCommand({
      id: "toggle-codemirror-in-preview-mode",
      name: "Toggle CodeMirror in Preview Mode",
      callback: () => {
        this.settings.enableCMinPreview = !this.settings.enableCMinPreview;
        this.saveData(this.settings);
        this.applyBodyClasses(true);
      },
    });
    this.addCommand({
      id: "toggle-cm-line-numbers-in-preview-mode",
      name: "Toggle CM Line Numbers in Preview Mode",
      callback: () => {
        this.settings.showLineNums = !this.settings.showLineNums;
        this.saveData(this.settings);
        this.applyBodyClasses(true);
      },
    });
    this.addCommand({
      id: "toggle-cm-copy-button-in-preview-mode",
      name: "Toggle Copy Button in Preview Mode",
      callback: () => {
        this.settings.copyButton = !this.settings.copyButton;
        this.saveData(this.settings);
        this.applyBodyClasses(true);
      },
    });
    this.addCommand({
      id: "toggle-auto-align-table",
      name: "Toggle Auto Align Tables",
      callback: () => {
        this.settings.autoAlignTables = !this.settings.autoAlignTables;
        this.saveData(this.settings);
        this.updateCodeMirrorOption("hmdTableAlign", this.settings.autoAlignTables);
      },
    });
  }

  mdProcessor = async (el: HTMLElement) => {
    setTimeout(() => {
      this.injectCM(el);
    }, 100);
  };

  injectCM(el: HTMLElement) {
    // only get code block elements with a language but not any that have already been colorized
    const preElement = el.firstChild as HTMLElement;
    const codeElement = el.firstChild?.firstChild as HTMLElement;
    if (!codeElement) return;
    if (codeElement.tagName !== "CODE") return;
    // TODO: Add an option to configure excluded languages
    if (codeElement.hasClass("language-mermaid")) return;
    if (!codeElement.classList.value.includes("language-")) {
      if (this.settings.copyButtonOnPRE) {
        this.addCopyButton(preElement);
      }
      return;
    }
    if (preElement.classList.value.includes("cm-s-obsidian")) return;
    codeElement.classList.forEach((className: string) => {
      if (className.startsWith("language-")) {
        // set data-lang to the code block language for easier colorize usage
        let language = className.replace("language-", "");
        switch (language) {
          case "html":
            language = "htmlmixed";
            break;
          case "js":
            language = "javascript";
            break;
          case "json":
            language = "javascript";
            break;
        }
        codeElement.setAttribute("data-lang", language);
      }
    });
    //@ts-ignore
    CodeMirror.colorize([codeElement], null, this.settings.showLineNums);
    preElement.querySelector(".copy-code-button").remove();
    this.addCopyButton(preElement);
  }

  addCopyButton(element: HTMLElement) {
    if (this.settings.copyButton) {
      const codeBlock = element;
      const copyButton = document.createElement("button");
      copyButton.className = "copy";
      copyButton.type = "button";
      // copyButton.ariaLabel = 'Copy code to clipboard';
      copyButton.innerText = "Copy";
      codeBlock.append(copyButton);
      copyButton.addEventListener("click", function () {
        // exclude line numbers when copying code to clipboard
        const code = codeBlock.querySelector("code");
        const clone = code.cloneNode(true) as HTMLElement;
        clone.findAll("span.cm-linenumber").forEach(e => e.remove());
        const codeText = clone.textContent.trim();
        window.navigator.clipboard.writeText(codeText);
        copyButton.innerText = "Copied";
        setTimeout(function () {
          copyButton.innerText = "Copy";
        }, 4000);
      });
    }
  }

  registerCodeMirrorSettings() {
    this.registerCodeMirror(cm => {
      cm.setOption("styleSelectedText", this.settings.markSelection);
      cm.setOption("singleCursorHeightPerLine", !this.settings.dynamicCursor);
      cm.setOption("styleActiveLine", this.settings.activeLineOnSelect ? { nonEmpty: true } : true);
      if (this.settings.enableOpenMD) cm.setOption("mode", "openmd");
      cm.setOption("hmdHideToken", this.settings.editModeHideTokens ? this.settings.tokenList : false);
      cm.setOption("hmdClick", this.settings.editModeClickHandler);
      cm.setOption("hmdTableAlign", this.settings.autoAlignTables);
      cm.setOption("cursorBlinkRate", this.settings.cursorBlinkRate);
      cm.setOption(
        "hmdFold",
        !this.settings.foldImages && !this.settings.foldLinks
          ? false
          : { image: this.settings.foldImages, link: this.settings.foldLinks }
      );
      if (this.settings.containerAttributes) this.updateCodeMirrorHandlers("renderLine", onRenderLine, true, true);
    });
  }

  onImageClick = args => {
    args.breakMark(args.editor, args.marker);
  };

  applyBodyClasses(refresh = false) {
    this.settings.editModeHideTokens
      ? !document.body.hasClass("hide-tokens")
        ? document.body.addClass("hide-tokens")
        : null
      : document.body.removeClass("hide-tokens");
    this.settings.markSelection
      ? !document.body.hasClass("style-active-selection")
        ? document.body.addClass("style-active-selection")
        : null
      : document.body.removeClass("style-active-selection");
    this.settings.enablePrismJSStyling
      ? !document.body.hasClass("fallback-highlighting")
        ? document.body.addClass("fallback-highlighting")
        : null
      : document.body.removeClass("fallback-highlighting");
    this.settings.showLineNums
      ? !document.body.hasClass("cm-show-line-nums")
        ? document.body.addClass("cm-show-line-nums")
        : null
      : document.body.removeClass("cm-show-line-nums");
    this.settings.copyButtonOnPRE
      ? !document.body.hasClass("cm-show-copy-button-on-pre")
        ? document.body.addClass("cm-show-copy-button-on-pre")
        : null
      : document.body.removeClass("cm-show-copy-button-on-pre");
    this.settings.syntaxHighlighting
      ? !document.body.hasClass("unified-cm-highlighting")
        ? document.body.addClass("unified-cm-highlighting")
        : null
      : document.body.removeClass("unified-cm-highlighting");
    this.settings.foldImages
      ? !document.body.hasClass("cm-render-images-inline")
        ? document.body.addClass("cm-render-images-inline")
        : null
      : document.body.removeClass("cm-render-images-inline");
    this.settings.enableCMinPreview
      ? this.registerMarkdownPostProcessor(this.mdProcessor)
      : MarkdownPreviewRenderer.unregisterPostProcessor(this.mdProcessor);
    if (refresh) this.refreshPanes();
  }

  unsetCodeMirrorOptions() {
    this.app.workspace.iterateCodeMirrors(cm => {
      // revert CodeMirror options back to the CM/Obsidian defaults
      cm.setOption("styleSelectedText", false);
      cm.setOption("singleCursorHeightPerLine", true);
      cm.setOption("styleActiveLine", true);
      cm.setOption("mode", "hypermd");
      cm.setOption("hmdHideToken", false);
      cm.setOption("hmdFold", false);
      cm.setOption("hmdTableAlign", false);
      cm.setOption("hmdClick", false);
      cm.setOption("cursorBlinkRate", 530);
      cm.off("renderLine", onRenderLine);
      // cm.off("imageClicked", this.onImageClick);
      cm.refresh();
    });
    document.body.removeClass("style-active-selection");
    document.body.removeClass("hide-tokens");
    document.body.removeClass("fallback-highlighting");
  }

  refreshPanes() {
    this.app.workspace.getLeavesOfType("markdown").forEach(leaf => {
      if (leaf.view instanceof MarkdownView) {
        leaf.view.previewMode.rerender(true);
      }
    });
  }

  getActiveCmEditor(): codemirror.Editor {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) return view.sourceMode?.cmEditor;
    return null;
  }

  updateCodeMirrorOption = debounce(
    (optionKey: keyof EditorConfiguration, optionValue: any, refresh = false) => {
      this.app.workspace.iterateCodeMirrors(cm => {
        if (cm && cm.getOption(optionKey) != optionValue) {
          cm.setOption(optionKey, optionValue);
          if (refresh) cm.refresh();
        }
      });
    },
    400,
    true
  );

  updateCodeMirrorHandlers = debounce(
    (eventType: string, callback: any, enable = true, refresh = false) => {
      this.app.workspace.iterateCodeMirrors(cm => {
        if (enable) cm.on(eventType, callback);
        else cm.off(eventType, callback);
        if (refresh) cm.refresh();
      });
    },
    0,
    true
  );

  onunload() {
    this.unsetCodeMirrorOptions();
    MarkdownPreviewRenderer.unregisterPostProcessor(this.mdProcessor);
    this.refreshPanes();
  }
}
