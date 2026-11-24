import { URL } from 'node:url';

export function enlaceRepositorio(remoto?: string): URL | undefined {
	if (!remoto) return;
	try {
		const direccion = remoto.replace(/^git@(?<host>[\w.-]+):(?<ruta>[^/].*)$/, 'ssh://git@$<host>/$<ruta>');
		const url = new URL(direccion);
		if (!['http:', 'https:', 'ssh:'].includes(url.protocol)) return;
		const ruta = url.pathname.replace(/\.git\/?$/, '').replace(/\/$/, '');
		if (!/^\/(?:[\w.-]+\/)+[\w.-]+$/.test(ruta)) return;
		const enlace = new URL('https://' + url.hostname);
		if (url.protocol !== 'ssh:') enlace.port = url.port;
		enlace.pathname = ruta;
		return enlace;
	} catch {
		return undefined;
	}
}

export function espacioExcluido(patrones: string[], carpetas: string[]) {
	return patrones.some((patron) => {
		try {
			const expresion = new RegExp(patron);
			return carpetas.some((carpeta) => expresion.test(carpeta));
		} catch {
			// Una exclusión inválida mantiene privada la actividad.
			return true;
		}
	});
}
