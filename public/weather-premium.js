/**
 * Lampa Weather Premium • Mykytyntsi Edition v1.0.0
 * Weather: Open-Meteo (https://open-meteo.com) — free for non-commercial use.
 * No API key, location permissions, jQuery plugins, external icons or libraries.
 * Fixed locations are intentional: no IP-based city detection.
 */
(function () {
    'use strict';

    if (window.__lampaMykytyntsiWeatherPremium) return;
    window.__lampaMykytyntsiWeatherPremium = true;

    var ID = 'mykytyntsi-weather-premium';
    var LOCATIONS = {
        frankivsk: { lat: 48.90589, lon: 24.75461, title: 'Микитинці' },
        kosiv:     { lat: 48.40345, lon: 25.06228, title: 'Микитинці' }
    };
    var SETTINGS = {
        enabled: 'mpw_enabled',
        place: 'mpw_place',
        style: 'mpw_style',
        detail: 'mpw_detail',
        lang: 'mpw_lang'
    };
    var DEFAULTS = {
        mpw_enabled: true,
        mpw_place: 'frankivsk',
        mpw_style: 'glass',
        mpw_detail: true,
        mpw_lang: 'ru'
    };
    var POLL_INTERVAL = 20 * 60 * 1000;
    var widget = null;
    var state = null;
    var loading = false;
    var lastLoad = 0;
    var requestId = 0;
    var subtitleIndex = 0;
    var subtitleTimer = null;
    var settingsRegistered = false;

    function read(name) {
        try {
            if (window.Lampa && Lampa.Storage && Lampa.Storage.get) {
                var val = Lampa.Storage.get(name, DEFAULTS[name]);
                return val == null ? DEFAULTS[name] : val;
            }
        } catch (e) {}
        return DEFAULTS[name];
    }

    function yes(name) {
        var value = read(name);
        return value !== false && value !== 'false' && value !== 0 && value !== '0';
    }

    function language() { return read(SETTINGS.lang) === 'uk' ? 'uk' : 'ru'; }
    function tr(ru, uk) { return language() === 'uk' ? uk : ru; }
    function point() { return LOCATIONS[read(SETTINGS.place)] || LOCATIONS.frankivsk; }

    function css() {
        if (document.getElementById(ID + '-css')) return;
        var el = document.createElement('style');
        el.id = ID + '-css';
        el.textContent = [
            '.mpw{position:relative;box-sizing:border-box;display:inline-flex;align-items:center;vertical-align:middle;gap:.48em;flex:0 0 auto;min-height:2.8em;max-width:25em;margin-left:.85em;padding:.28em .83em .3em .55em;border:1px solid rgba(255,255,255,.18);border-radius:999px;color:#fff;background:linear-gradient(118deg,rgba(55,72,104,.68),rgba(25,31,50,.64));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 .22em 1.15em rgba(0,0,0,.14);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);font-family:inherit;line-height:1;pointer-events:none;overflow:hidden;isolation:isolate;white-space:nowrap;transition:background .6s ease, border-color .6s ease;}',
            '.mpw:before{content:"";position:absolute;inset:-150% -30%;z-index:-1;opacity:.4;transform:translateX(-70%) rotate(18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);animation:mpw-glint 18s ease-in-out infinite;}',
            '.mpw.mpw-clear{border-color:rgba(255,212,139,.24);background:linear-gradient(115deg,rgba(113,76,37,.68),rgba(45,53,74,.7));}',
            '.mpw.mpw-cloudy{background:linear-gradient(115deg,rgba(61,79,107,.78),rgba(37,45,65,.78));}',
            '.mpw.mpw-rain{background:linear-gradient(115deg,rgba(30,85,132,.78),rgba(29,45,78,.83));}',
            '.mpw.mpw-snow{background:linear-gradient(115deg,rgba(71,109,139,.79),rgba(43,60,90,.84));}',
            '.mpw.mpw-night{background:linear-gradient(115deg,rgba(49,46,93,.81),rgba(18,28,62,.87));border-color:rgba(159,173,255,.28);}',
            '.mpw-icon{width:2.1em;height:2.1em;display:grid;place-items:center;flex:0 0 auto;filter:drop-shadow(0 .12em .2em rgba(0,0,0,.13));}',
            '.mpw-icon svg{height:100%;width:100%;display:block;overflow:visible;}',
            '.mpw-temp{font-size:1.42em;font-weight:700;line-height:1;letter-spacing:-.055em;font-variant-numeric:tabular-nums;flex-shrink:0;text-shadow:0 1px 9px rgba(0,0,0,.14);}',
            '.mpw-text{min-width:0;display:flex;flex-direction:column;gap:.23em;}',
            '.mpw-place{font-size:.83em;line-height:1.05;font-weight:650;letter-spacing:.01em;overflow:hidden;text-overflow:ellipsis;}',
            '.mpw-desc{font-size:.62em;line-height:1.08;opacity:.82;overflow:hidden;text-overflow:ellipsis;transition:opacity .22s ease;}',
            '.mpw-desc.mpw-fade{opacity:.05;}',
            '.mpw.mpw-clean{background:transparent!important;border-color:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none;backdrop-filter:none;padding-left:0;padding-right:0;}',
            '.mpw.mpw-clean:before{display:none;}',
            '.mpw-sun{transform-origin:32px 32px;animation:mpw-sun-spin 36s linear infinite;}',
            '.mpw-cloud{animation:mpw-cloud 6s ease-in-out infinite;}',
            '.mpw-drop-a{animation:mpw-rain 1.6s ease-in infinite;}',
            '.mpw-drop-b{animation:mpw-rain 1.6s ease-in .5s infinite;}',
            '.mpw-star{animation:mpw-blink 3s ease-in-out infinite;}',
            '@keyframes mpw-glint{0%,65%,100%{transform:translateX(-70%) rotate(18deg)}78%{transform:translateX(95%) rotate(18deg)}}',
            '@keyframes mpw-sun-spin{to{transform:rotate(360deg)}}',
            '@keyframes mpw-cloud{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.2px)}}',
            '@keyframes mpw-rain{0%{opacity:0;transform:translateY(-3px)}25%{opacity:1}85%,100%{opacity:0;transform:translateY(4px)}}',
            '@keyframes mpw-blink{0%,100%{opacity:.3}50%{opacity:1}}',
            '@media (max-width:1400px){.mpw{max-width:17em;padding-right:.55em}.mpw-icon{width:1.85em;height:1.85em}.mpw-temp{font-size:1.25em}.mpw-place{font-size:.73em}.mpw-desc{font-size:.58em}}',
            '@media (max-width:850px){.mpw{margin-left:.35em;padding:.25em .45em;min-height:2.25em;gap:.25em;max-width:8em}.mpw-icon{width:1.65em;height:1.65em}.mpw-text{display:none}.mpw-temp{font-size:1.2em}}',
            '@media (prefers-reduced-motion:reduce){.mpw *, .mpw:before{animation:none!important;transition:none!important}}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(el);
    }

    function svgIcon(group, isDay) {
        var sun = '<g class="mpw-sun" stroke="#FFD888" stroke-width="2.8" stroke-linecap="round" fill="none"><circle cx="29" cy="29" r="9.5" fill="#FFCF6B" stroke="#F3AB49" stroke-width="1.2"/>' +
            '<path d="M29 7v8M29 43v8M7 29h8M43 29h8M13.5 13.5l5.7 5.7M39 39l5.7 5.7M44.5 13.5l-5.7 5.7M19.2 39l-5.7 5.7"/></g>';
        var moon = '<g fill="none" stroke="#BFD2FF" stroke-width="2.2"><path d="M38 11A20 20 0 1 0 49 42c-12 2-24-10-20-24 2-4 5-6 9-7z" fill="#A9BFFF" opacity=".88"/></g><path class="mpw-star" d="M48 11v8m-4-4h8" stroke="#E4E9FF" stroke-width="1.7" stroke-linecap="round"/>';
        var cloud = '<g class="mpw-cloud"><path d="M16 43.5h31a10 10 0 0 0 .9-20 16 16 0 0 0-30.8 4A8 8 0 0 0 16 43.5z" fill="#E5EEF8" stroke="#B7CADC" stroke-width="1.6" stroke-linejoin="round"/></g>';
        var smallCloud = '<g class="mpw-cloud"><path d="M18 45h31a9 9 0 0 0 1-18 15 15 0 0 0-29 3 7.5 7.5 0 0 0-3 15z" fill="#E0EBF7" stroke="#AFC4DE" stroke-width="1.4"/></g>';
        var content;
        if (group === 'clear') content = isDay ? sun : moon;
        else if (group === 'partly') content = (isDay ? sun : moon) + smallCloud;
        else if (group === 'fog') content = cloud + '<g stroke="#C9E1F9" stroke-width="2.4" stroke-linecap="round" opacity=".86"><path d="M12 49h35M20 54h34"/></g>';
        else if (group === 'rain' || group === 'drizzle') content = cloud + '<g stroke="#7FD5FF" stroke-width="3" stroke-linecap="round"><path class="mpw-drop-a" d="M22 49l-3 6"/><path class="mpw-drop-b" d="M34 49l-3 6"/><path class="mpw-drop-a" d="M46 49l-3 6"/></g>';
        else if (group === 'snow') content = cloud + '<g stroke="#C6EFFF" stroke-width="2" stroke-linecap="round"><path d="M22 51v8m-4-4h8m8-4v8m-4-4h8m8-4v8m-4-4h8"/></g>';
        else if (group === 'storm') content = cloud + '<path d="M34 45 26 56h8l-4 7 16-16h-9l4-6" transform="translate(-1 -5)" fill="#FFD16F" stroke="#F7A33C" stroke-width="1.2" stroke-linejoin="round"/>';
        else content = cloud;
        return '<svg viewBox="0 0 64 64" role="presentation" aria-hidden="true">' + content + '</svg>';
    }

    function condition(code, isDay) {
        if (code === 0) return { tone: 'clear', icon: 'clear', text: tr(isDay ? 'Ясно' : 'Ясная ночь', isDay ? 'Ясно' : 'Ясна ніч') };
        if (code === 1 || code === 2) return { tone: 'clear', icon: 'partly', text: tr('Переменная облачность', 'Мінлива хмарність') };
        if (code === 3) return { tone: 'cloudy', icon: 'cloud', text: tr('Облачно', 'Хмарно') };
        if (code === 45 || code === 48) return { tone: 'cloudy', icon: 'fog', text: tr('Туман', 'Туман') };
        if (code >= 51 && code <= 57) return { tone: 'rain', icon: 'drizzle', text: tr('Морось', 'Мряка') };
        if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { tone: 'rain', icon: 'rain', text: tr('Дождь', 'Дощ') };
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { tone: 'snow', icon: 'snow', text: tr('Снег', 'Сніг') };
        if (code >= 95) return { tone: 'rain', icon: 'storm', text: tr('Гроза', 'Гроза') };
        return { tone: 'cloudy', icon: 'cloud', text: tr('Погода', 'Погода') };
    }

    function degree(number, withSign) {
        var val = Math.round(Number(number));
        if (!isFinite(val)) return '—';
        return (withSign && val > 0 ? '+' : '') + val + '°';
    }

    function makeWidget() {
        if (widget) return widget;
        css();
        widget = document.createElement('div');
        widget.className = 'mpw mpw-cloudy';
        widget.id = ID;
        widget.setAttribute('aria-label', 'Погода: Микитинці');
        widget.innerHTML = '<span class="mpw-icon"></span>' +
            '<span class="mpw-temp">—°</span>' +
            '<span class="mpw-text"><span class="mpw-place">Микитинці</span>' +
            '<span class="mpw-desc"></span></span>';
        return widget;
    }

    function setSubtitle(newText, immediate) {
        if (!widget) return;
        var line = widget.querySelector('.mpw-desc');
        if (!line || line.textContent === newText) return;
        if (subtitleTimer) { clearTimeout(subtitleTimer); subtitleTimer = null; }
        if (immediate) {
            line.textContent = newText;
            line.classList.remove('mpw-fade');
            return;
        }
        line.classList.add('mpw-fade');
        subtitleTimer = setTimeout(function () {
            if (line && line.parentNode) {
                line.textContent = newText;
                line.classList.remove('mpw-fade');
            }
            subtitleTimer = null;
        }, 220);
    }

    function details() {
        if (!state) return [tr('Обновляем…', 'Оновлюємо…')];
        var c = condition(state.code, state.isDay);
        if (!yes(SETTINGS.detail)) return [c.text];
        var today = tr('Сегодня', 'Сьогодні');
        return [
            c.text,
            tr('Ощущается ', 'Відчувається ') + degree(state.feels, true) + ' · ' + state.humidity + '%',
            today + ' ' + degree(state.hi, true) + ' / ' + degree(state.lo, true)
        ];
    }

    function render() {
        makeWidget();
        var enabled = yes(SETTINGS.enabled);
        widget.style.display = enabled ? 'inline-flex' : 'none';
        if (!enabled) return;
        widget.classList.toggle('mpw-clean', read(SETTINGS.style) === 'clean');
        var c = state ? condition(state.code, state.isDay) : null;
        widget.classList.remove('mpw-clear', 'mpw-cloudy', 'mpw-rain', 'mpw-snow', 'mpw-night');
        widget.classList.add('mpw-' + (c ? c.tone : 'cloudy'));
        if (state && !state.isDay) widget.classList.add('mpw-night');
        var iconMarkup = svgIcon(c ? c.icon : 'cloud', state ? state.isDay : true);
        var iconSlot = widget.querySelector('.mpw-icon');
        if (iconSlot && iconSlot.innerHTML !== iconMarkup) iconSlot.innerHTML = iconMarkup;
        widget.querySelector('.mpw-temp').textContent = state ? degree(state.temp, true) : '—°';
        widget.querySelector('.mpw-place').textContent = point().title;
        widget.setAttribute('title', tr('Микитинці · данные Open-Meteo', 'Микитинці · дані Open-Meteo'));
        widget.setAttribute('aria-label', point().title + ': ' + (state ? degree(state.temp, true) + ', ' + c.text : tr('загрузка погоды', 'завантаження погоди')));
        var texts = details();
        setSubtitle(texts[subtitleIndex % texts.length], true);
    }

    function mount() {
        registerSettings();
        if (!document.body) return;
        var headerTime = document.querySelector('.head__time');
        if (!headerTime || !headerTime.parentNode) return;
        makeWidget();
        if (widget.parentNode !== headerTime.parentNode || widget.previousSibling !== headerTime) {
            headerTime.parentNode.insertBefore(widget, headerTime.nextSibling);
        }
        widget.style.display = yes(SETTINGS.enabled) ? 'inline-flex' : 'none';
    }

    function cacheKey() { return 'lampa_mpw_cache_' + read(SETTINGS.place); }

    function getCache() {
        try {
            var raw = localStorage.getItem(cacheKey());
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (!obj || !obj.time || Date.now() - obj.time > 3 * 3600 * 1000) return null;
            return obj.data;
        } catch (e) { return null; }
    }

    function putCache(data) {
        try { localStorage.setItem(cacheKey(), JSON.stringify({ time: Date.now(), data: data })); }
        catch (e) {}
    }

    function parseWeather(result) {
        if (!result || !result.current || typeof result.current.temperature_2m !== 'number') {
            throw new Error('Unexpected Open-Meteo response');
        }
        var c = result.current;
        var d = result.daily || {};
        function first(data, fallback) {
            return data && typeof data[0] === 'number' ? data[0] : fallback;
        }
        return {
            temp: c.temperature_2m,
            feels: typeof c.apparent_temperature === 'number' ? c.apparent_temperature : c.temperature_2m,
            humidity: typeof c.relative_humidity_2m === 'number' ? Math.round(c.relative_humidity_2m) : 0,
            code: Number(c.weather_code) || 0,
            isDay: Number(c.is_day) === 1,
            hi: first(d.temperature_2m_max, c.temperature_2m),
            lo: first(d.temperature_2m_min, c.temperature_2m)
        };
    }

    function load(force) {
        if (!yes(SETTINGS.enabled) || loading) return;
        if (!force && state && Date.now() - lastLoad < POLL_INTERVAL) return;
        var p = point();
        var thisRequest = ++requestId;
        var url = 'https://api.open-meteo.com/v1/forecast' +
            '?latitude=' + encodeURIComponent(p.lat) +
            '&longitude=' + encodeURIComponent(p.lon) +
            '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code' +
            '&daily=temperature_2m_max,temperature_2m_min' +
            '&forecast_days=1&timezone=Europe%2FKyiv';
        loading = true;
        lastLoad = Date.now();

        function success(raw) {
            if (thisRequest !== requestId) return;
            loading = false;
            try {
                state = parseWeather(typeof raw === 'string' ? JSON.parse(raw) : raw);
                putCache(state);
                subtitleIndex = 0;
                render();
            } catch (e) { fail(e); }
        }
        function fail(error) {
            if (thisRequest !== requestId) return;
            loading = false;
            lastLoad = 0;
            if (!state) state = getCache();
            if (state) render();
            else setSubtitle(tr('Нет связи с погодой', 'Немає зв’язку з погодою'), true);
            if (window.console && console.warn) console.warn('[Lampa Weather Premium] Weather unavailable', error || 'network');
        }
        try {
            if (typeof window.fetch === 'function') {
                // Simple timeout without AbortController for older TV browsers.
                var expired = false;
                var timeout = setTimeout(function () { expired = true; fail('timeout'); }, 10000);
                fetch(url).then(function (response) {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.json();
                }).then(function (result) {
                    clearTimeout(timeout);
                    if (!expired) success(result);
                }).catch(function (err) {
                    clearTimeout(timeout);
                    if (!expired) fail(err);
                });
            } else if (window.jQuery && jQuery.ajax) {
                jQuery.ajax({ url: url, dataType: 'json', timeout: 10000, success: success, error: fail });
            } else {
                fail('No network client');
            }
        } catch (e) { fail(e); }
    }

    function refreshLocation() {
        requestId++;
        loading = false;
        state = getCache();
        lastLoad = 0;
        subtitleIndex = 0;
        render();
        load(true);
    }

    function option(name, type, values, defaultValue, title, hint, changed) {
        return {
            component: 'style_interface',
            param: { name: name, type: type, values: values, 'default': defaultValue },
            field: { name: title, description: hint },
            onChange: changed
        };
    }

    function registerSettings() {
        if (settingsRegistered || !window.Lampa || !Lampa.SettingsApi || !Lampa.SettingsApi.addParam) return;
        settingsRegistered = true;
        try {
            Lampa.SettingsApi.addParam(option(SETTINGS.enabled, 'trigger', undefined, true,
                'Погода Premium — показывать', 'Погода рядом с часами в верхней панели Lampa', function () { render(); mount(); load(true); }));
            Lampa.SettingsApi.addParam(option(SETTINGS.place, 'select', {
                frankivsk: 'Микитинці — Івано-Франківська громада',
                kosiv: 'Микитинці — Косівський район'
            }, 'frankivsk', 'Погода Premium — населённый пункт', 'Оба населённых пункта находятся в Ивано-Франковской области', refreshLocation));
            Lampa.SettingsApi.addParam(option(SETTINGS.style, 'select', {
                glass: 'Glass — полупрозрачная капсула', clean: 'Minimal — без фона'
            }, 'glass', 'Погода Premium — оформление', 'Оптимизировано для Samsung Tizen', render));
            Lampa.SettingsApi.addParam(option(SETTINGS.detail, 'trigger', undefined, true,
                'Погода Premium — детали', 'Поочерёдно показывать состояние, ощущаемую температуру и минимум/максимум', render));
            Lampa.SettingsApi.addParam(option(SETTINGS.lang, 'select', {
                ru: 'Русский', uk: 'Українська'
            }, 'ru', 'Погода Premium — язык', 'Название Микитинці всегда на украинском', render));
        } catch (e) {
            if (window.console && console.warn) console.warn('[Lampa Weather Premium] Settings unavailable', e);
        }
    }

    function start() {
        css();
        registerSettings();
        state = getCache();
        render();
        mount();
        load(true);
        setInterval(mount, 3500);
        setInterval(function () { if (yes(SETTINGS.enabled)) load(false); }, 60 * 1000);
        setInterval(function () {
            if (!state || !yes(SETTINGS.enabled)) return;
            subtitleIndex++;
            var lines = details();
            setSubtitle(lines[subtitleIndex % lines.length], false);
        }, 8500);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && Date.now() - lastLoad > POLL_INTERVAL) load(false);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
