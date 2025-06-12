interface CodeBlockProps {
  code: string;
  language?: 'javascript' | 'typescript';
}

interface SyntaxToken {
  type: 'keyword' | 'property' | 'operator' | 'variable' | 'punctuation' | 'text';
  value: string;
}

export function CodeBlock({ code, language = 'javascript' }: CodeBlockProps) {
  const tokenizeJavaScript = (code: string): SyntaxToken[] => {
    const tokens: SyntaxToken[] = [];

    // Simple tokenizer for the specific code: window.__TANSTACK_QUERY_CLIENT__ = queryClient
    const parts = code.split(/(\.|=|\s+)/);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!part) continue;

      if (part === 'window') {
        tokens.push({ type: 'keyword', value: part });
      } else if (part === '.') {
        tokens.push({ type: 'punctuation', value: part });
      } else if (part === '__TANSTACK_QUERY_CLIENT__') {
        tokens.push({ type: 'property', value: part });
      } else if (part === '=') {
        tokens.push({ type: 'operator', value: part });
      } else if (part === 'queryClient') {
        tokens.push({ type: 'variable', value: part });
      } else if (part.trim() === '') {
        tokens.push({ type: 'text', value: part });
      } else {
        tokens.push({ type: 'text', value: part });
      }
    }

    return tokens;
  };

  const getTokenClassName = (type: SyntaxToken['type']): string => {
    switch (type) {
      case 'keyword':
        return 'text-blue-600 dark:text-blue-400'; // VSCode keyword blue
      case 'property':
        return 'text-blue-800 dark:text-blue-300'; // VSCode property dark blue
      case 'operator':
        return 'text-gray-600 dark:text-gray-400'; // VSCode operator gray
      case 'variable':
        return 'text-blue-800 dark:text-blue-300'; // VSCode variable dark blue
      case 'punctuation':
        return 'text-gray-600 dark:text-gray-400'; // VSCode punctuation gray
      case 'text':
      default:
        return 'text-gray-800 dark:text-gray-200'; // Default text color
    }
  };

  const tokens = language === 'javascript' ? tokenizeJavaScript(code) : [{ type: 'text' as const, value: code }];

  return (
    <code className="text-sm font-mono">
      {tokens.map((token, index) => (
        <span key={index} className={getTokenClassName(token.type)}>
          {token.value}
        </span>
      ))}
    </code>
  );
}
