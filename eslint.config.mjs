import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['**/node_modules/', '.git/', '**/dist/', '**/coverage/', '**/@types/'] },
	...tseslint.configs.recommended,
	{
		files: ['**/*.{ts,mts,cts}'],
		rules: {
			'require-atomic-updates': 'error',
			'no-restricted-globals': ['error', 'setTimeout', 'clearTimeout'],
			'@typescript-eslint/consistent-type-definitions': [2, 'interface'],
			'@typescript-eslint/naming-convention': [
				2,
				{
					selector: 'typeParameter',
					format: ['PascalCase'],
					custom: {
						regex: '^\\w{3,}',
						match: true,
					},
				},
			],
		},
	},
);
