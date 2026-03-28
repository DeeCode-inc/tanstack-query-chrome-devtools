import { useState } from "react";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import { Copy, Check } from "lucide-react";

hljs.registerLanguage("typescript", typescript);

interface CodeSnippetProps {
  code: string;
  language: string;
  preClassName?: string;
}

export function CodeSnippet({ code, language, preClassName }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const highlighted = hljs.highlight(code, { language }).value;

  const handleCopy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-200/80 dark:bg-gray-700/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        aria-label={copied ? "Copied" : "Copy to clipboard"}
      >
        {copied ? (
          <Check className="size-4 text-green-600 dark:text-green-400" />
        ) : (
          <Copy className="size-4 text-gray-600 dark:text-gray-300" />
        )}
      </button>
      <pre className={`hljs rounded-lg p-4 overflow-x-auto text-sm whitespace-pre-wrap border border-gray-300 dark:border-gray-600${preClassName ? ` ${preClassName}` : ""}`}>
        {/* Safe: input is a hardcoded static string, not user content */}
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
