import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { createHighlighter } from "shiki";

export default async function markdownToHtml(markdown: string) {
  const highlighter = await createHighlighter({
    themes: ["slack-dark"],
    langs: ["javascript", "typescript", "python", "bash", "text", "c"],
  });

  const tree = remark()
    .use(remarkRehype)
    .use(() => (tree) => {
      visit(tree, "element", (node: any) => {
        if (node.tagName === "code" && node.properties?.className) {
          const langClass = node.properties.className.find((c: string) =>
            c.startsWith("language-")
          );
          if (langClass) {
            const lang = langClass.replace("language-", "");
            const code = node.children.map((n: any) => n.value).join("");
            node.type = "raw"; // allow raw HTML
            node.value = highlighter.codeToHtml(code, { lang, theme: "slack-dark" });
          }
        }
      });
    })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const result = await tree.process(markdown);
  return result.toString();
}
