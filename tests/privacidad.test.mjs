import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const compilado = await build({
	entryPoints: ['src/privacidad.ts'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	write: false,
});
const { enlaceRepositorio, espacioExcluido } = await import(
	'data:text/javascript;base64,' + Buffer.from(compilado.outputFiles[0].contents).toString('base64')
);

test('publica solo el destino del repositorio', () => {
	for (const remoto of [
		'https://usuario:ejemplo@github.com/grupo/repo.git?dato=privado#seccion',
		'git@github.com:grupo/repo.git',
		'ssh://git@github.com/grupo/repo.git',
	]) {
		assert.equal(enlaceRepositorio(remoto)?.href, 'https://github.com/grupo/repo');
	}
	assert.equal(enlaceRepositorio('file:///local/repo'), undefined);
});

test('recalcula exclusiones para todas las carpetas y protege patrones inválidos', () => {
	assert.equal(espacioExcluido(['privado'], ['/publico', '/privado']), true);
	assert.equal(espacioExcluido(['privado'], ['/publico']), false);
	assert.equal(espacioExcluido(['['], ['/publico']), true);
});

test('descarta envíos pendientes al excluir una carpeta o cambiar los patrones', async () => {
	const modulo = await build({
		entryPoints: ['src/extension.ts'],
		platform: 'node',
		format: 'cjs',
		write: false,
		bundle: true,
		external: ['vscode', '@xhayper/discord-rpc', './activity', './logger', './util', 'lodash-es/throttle'],
	});
	const eventos = {};
	const escuchar = (nombre) => (fn) => {
		eventos[nombre] = fn;
		return { dispose() {} };
	};
	const config = { enabled: true, workspaceExcludePatterns: ['privado'] };
	const espacio = {
		workspaceFolders: [{ uri: { fsPath: '/publico' } }],
		onDidChangeWorkspaceFolders: escuchar('carpetas'),
		onDidChangeConfiguration: escuchar('configuracion'),
		onDidChangeTextDocument: escuchar('texto'),
	};
	const publicados = [];
	let retirados = 0;
	class Cliente {
		user = {
			setActivity: (valor) => publicados.push(valor),
			clearActivity: () => {
				retirados++;
			},
		};
		on(nombre, fn) {
			eventos[nombre] = fn;
		}
		login() {
			eventos.ready();
		}
	}
	const pendientes = [];
	const modulos = {
		vscode: {
			workspace: espacio,
			StatusBarAlignment: { Left: 0 },
			window: {
				createStatusBarItem: () => ({ show() {} }),
				onDidChangeActiveTextEditor: escuchar('editor'),
				onDidChangeWindowState: escuchar('ventana'),
			},
			commands: { registerCommand: escuchar },
			debug: { onDidStartDebugSession: escuchar('inicio'), onDidTerminateDebugSession: escuchar('fin') },
		},
		'@xhayper/discord-rpc': { Client: Cliente },
		'./util': { getConfig: () => config, getGit: () => null },
		'./logger': { log() {}, LogLevel: { Info: 0 } },
		'./activity': { activity: () => new Promise((resolve) => pendientes.push(resolve)) },
		'lodash-es/throttle': (fn) => fn,
	};
	const contexto = { module: { exports: {} }, require: (id) => modulos[id] };
	runInNewContext(modulo.outputFiles[0].text, contexto);
	await contexto.module.exports.activate({ subscriptions: [] });
	espacio.workspaceFolders.push({ uri: { fsPath: '/privado' } });
	await eventos.carpetas();
	pendientes.shift()({ details: 'anterior' });
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(retirados, 1);
	assert.equal(publicados.length, 0);
	config.workspaceExcludePatterns = [];
	const actualizar = eventos.configuracion({ affectsConfiguration: () => true });
	pendientes.shift()({ details: 'visible' });
	await actualizar;
	assert.equal(publicados.length, 1);
	config.workspaceExcludePatterns = ['privado'];
	await eventos.configuracion({ affectsConfiguration: () => true });
	assert.equal(retirados, 2);
});
