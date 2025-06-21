import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/vs2015.css"; // VS Code dark theme

// Register TypeScript language
hljs.registerLanguage("typescript", typescript);

interface CodeBlockProps {
  code: string;
}

export function CodeBlock({ code }: CodeBlockProps) {
  const highlighted = hljs.highlight(code, { language: "typescript" }).value;

  return (
    <pre className="text-sm font-mono whitespace-pre-wrap">
      <code dangerouslySetInnerHTML={{ __html: highlighted }} />
    </pre>
  );
}
