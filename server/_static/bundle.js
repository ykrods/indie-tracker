var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function stop_propagation(fn) {
        return function (event) {
            event.stopPropagation();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function xlink_attr(node, attribute, value) {
        node.setAttributeNS('http://www.w3.org/1999/xlink', attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }
    class HtmlTag {
        constructor(anchor = null) {
            this.a = anchor;
            this.e = this.n = null;
        }
        m(html, target, anchor = null) {
            if (!this.e) {
                this.e = element(target.nodeName);
                this.t = target;
                this.h(html);
            }
            this.i(anchor);
        }
        h(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(this.t, this.n[i], anchor);
            }
        }
        p(html) {
            this.d();
            this.h(html);
            this.i(this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                info.blocks[i] = null;
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe,
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    // Store used by router to detect changes.
    const currentPath = writable(null);

    // Store for component or application using router.
    const currentRoute = writable(null);

    // Store of path variables (a bit convinient for getting $currentRoute.params).
    const routeParams = derived(currentRoute, ($currentRoute) => {
      return $currentRoute ? ($currentRoute.params || {}) : {};
    });

    /* node_modules/svelte-spa-history-router/src/Router.svelte generated by Svelte v3.24.1 */

    function create_fragment(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*currentComponent*/ ctx[0];

    	function switch_props(ctx) {
    		return {};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	return {
    		c() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (switch_value !== (switch_value = /*currentComponent*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let $currentPath;
    	let $currentRoute;
    	component_subscribe($$self, currentPath, $$value => $$invalidate(2, $currentPath = $$value));
    	component_subscribe($$self, currentRoute, $$value => $$invalidate(3, $currentRoute = $$value));
    	let { routes = [] } = $$props;

    	onMount(() => {
    		// initialze
    		currentPath.set(window.location.pathname);

    		const popstateListener = evt => {
    			currentPath.set(window.location.pathname);
    		};

    		window.addEventListener("popstate", popstateListener);

    		return () => {
    			window.removeEventListener("popstate", popstateListener);
    		};
    	});

    	function resolveRoute(currentPath) {
    		if (!currentPath) {
    			return null;
    		}

    		for (const { path, component } of routes) {
    			const re = new RegExp(`^${path}$`, "i");
    			const match = currentPath.match(re);

    			if (match) {
    				return { path, component, params: match.groups };
    			}
    		}

    		
    		throw new Error(`No route for ${currentPath} exists.`);
    	}

    	$$self.$$set = $$props => {
    		if ("routes" in $$props) $$invalidate(1, routes = $$props.routes);
    	};

    	let currentComponent;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$currentPath*/ 4) {
    			 currentRoute.set(resolveRoute($currentPath));
    		}

    		if ($$self.$$.dirty & /*$currentRoute*/ 8) {
    			 $$invalidate(0, currentComponent = $currentRoute !== null ? $currentRoute.component : null);
    		}
    	};

    	return [currentComponent, routes];
    }

    class Router extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { routes: 1 });
    	}
    }

    function push(next) {
        window.history.pushState({}, '', next);

        // Exclude queryString and hash
        const url = new URL(next, window.location.origin);
        currentPath.set(url.pathname);
    }

    function link(node) {
      function onClick(event) {
        event.preventDefault();
        push(node.getAttribute('href'));
      }

      node.addEventListener('click', onClick);

      return {
        destroy() {
          node.removeEventListener('click', onClick);
        }
      }
    }

    const db = writable(null);

    const project = writable({ repo_name: "---" });

    const selectedStatuses = writable(["OPEN"]);

    function convert(data) {
      const dateFields = ["created_at", "updated_at"];
      for (const field of dateFields) {
        if (data[field] === undefined) {
          continue;
        }
        try {
          const d = new Date(data[field]);
          data[field] = d === NaN ? null : d;
        } catch (e) {
          data[field] = null;
        }
      }
      return data;
    }

    const socket = (() => {
      const { subscribe, set } = writable(null);

      let ws;

      return {
        subscribe,
        send(message) {
          ws.send(JSON.stringify(message));
        },
        open(project, db) {
          const protocol = location.protocol == "http:" ? "ws:" : "wss:";
          ws = new WebSocket(
            `${protocol}//${location.host}/ws?name=${project.name}`
          );
          // TODO: retry
          ws.onopen = async (event) => {
            const config = await db.configs.get("commit");
            const commit = (config ? config.value : null) || null;
            const msg = { type: "sync", commit };
            ws.send(JSON.stringify(msg));
          };

          ws.onclose = (event) => {
            // console.log(event);
          };

          ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case "issue":
                db.issues.put(convert(msg.data));
                break;
              case "issue_deleted":
                db.issues.delete(msg.id);
                break;
            }
            if (msg.commit) {
              db.configs.put({ id: "commit", value: msg.commit });
            }
            // publish after update db
            set(msg);
          };
        },
      };
    })();

    /**
     * api.js
     */
    const client = {
      /**
       * fetch options for POST or PUT
       */
      _options(method, data) {
        return {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        };
      },

      async get(resource) {
        const res = await fetch(resource, { method: "GET" });
        const res_data = await res.json();

        if (res.ok) {
          return res_data;
        } else if (res.status === 404) {
          return null;
        }
        throw new Error(res_data);
      },
      async post(resource, data) {
        const res = await fetch(resource, this._options("POST", data));
        const res_data = await res.json();

        if (res.ok) {
          return res_data;
        }
        throw new Error(res.error);
      },
      async put(resource, data) {
        const res = await fetch(resource, this._options("PUT", data));
        const res_data = await res.json();

        if (res.ok) {
          return res_data;
        }
        throw new Error(res.error);
      },
      async delete(resource) {
        const res = await fetch(resource, { method: "DELETE" });

        if (res.status === 204) {
          return;
        } else if (res.ok) {
          const res_data = await res.json();
          return res_data;
        }
        throw new Error(res.error);
      },
    };

    async function getProject() {
      return client.get("/api/project");
    }

    async function getUserIdentity() {
      const identity = await client.get("/api/user_identity");
      return identity.user_identity;
    }

    async function addIssue(issue) {
      return client.post(`/api/issues`, issue);
    }
    async function updateIssue(issueId, issue) {
      return client.put(`/api/issues/${issueId}`, issue);
    }

    async function deleteIssue(issueId) {
      return client.delete(`/api/issues/${issueId}`);
    }

    async function addIssueComment(issueId, comment) {
      return client.post(`/api/issues/${issueId}/comments`, comment);
    }

    async function updateIssueComment(issueId, commentId, comment) {
      return client.put(`/api/issues/${issueId}/comments/${commentId}`, comment);
    }

    async function deleteIssueComment(issueId, commentId) {
      return client.delete(`/api/issues/${issueId}/comments/${commentId}`);
    }

    async function getWikiPage(pageId) {
      const ret = await client.get(`/api/wiki/${pageId}`);

      // replace null to '' for svelte spread props
      ret.body = ret.body || "";
      return ret;
    }

    async function putWikiPage(pageId, wikiPage) {
      return client.put(`/api/wiki/${pageId}`, wikiPage);
    }

    async function deleteWikiPage(pageId) {
      const ret = await client.delete(`/api/wiki/${pageId}`);

      // replace null to '' for svelte spread props
      ret.body = "";
      return ret;
    }

    async function getHTML(rst) {
      const data = await client.post(`/api/preview`, { rst });
      return data.html;
    }

    /* src/common/Header.svelte generated by Svelte v3.24.1 */

    function create_fragment$1(ctx) {
    	let header;
    	let div;
    	let t0_value = /*$project*/ ctx[1].name + "";
    	let t0;
    	let t1;
    	let a0;
    	let link_action;
    	let t3;
    	let a1;
    	let link_action_1;
    	let t5;
    	let span;
    	let t6;
    	let t7;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			header = element("header");
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			a0 = element("a");
    			a0.textContent = "Issues";
    			t3 = space();
    			a1 = element("a");
    			a1.textContent = "Wiki";
    			t5 = space();
    			span = element("span");
    			t6 = text("Commiter: ");
    			t7 = text(/*user_identity*/ ctx[0]);
    			attr(div, "class", "project-name svelte-fhml4q");
    			attr(a0, "class", "nav-link svelte-fhml4q");
    			attr(a0, "href", "/");
    			attr(a1, "class", "nav-link svelte-fhml4q");
    			attr(a1, "href", "/wiki/");
    			attr(span, "class", "user-identity svelte-fhml4q");
    			attr(header, "class", "svelte-fhml4q");
    		},
    		m(target, anchor) {
    			insert(target, header, anchor);
    			append(header, div);
    			append(div, t0);
    			append(header, t1);
    			append(header, a0);
    			append(header, t3);
    			append(header, a1);
    			append(header, t5);
    			append(header, span);
    			append(span, t6);
    			append(span, t7);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(link_action = link.call(null, a0)),
    					action_destroyer(link_action_1 = link.call(null, a1))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$project*/ 2 && t0_value !== (t0_value = /*$project*/ ctx[1].name + "")) set_data(t0, t0_value);
    			if (dirty & /*user_identity*/ 1) set_data(t7, /*user_identity*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(header);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $project;
    	component_subscribe($$self, project, $$value => $$invalidate(1, $project = $$value));
    	let user_identity = "";

    	onMount(async () => {
    		$$invalidate(0, user_identity = await getUserIdentity());
    	});

    	return [user_identity, $project];
    }

    class Header extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }
    function quintOut(t) {
        return --t * t * t * t * t + 1;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function scale(node, { delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const sd = 1 - start;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
        };
    }

    function oe(n){return l=>{const o=Object.keys(n.$$.callbacks),i=[];return o.forEach(o=>i.push(listen(l,o,e=>bubble(n,e)))),{destroy:()=>{i.forEach(e=>e());}}}}function ie(){return "undefined"!=typeof window&&!(window.CSS&&window.CSS.supports&&window.CSS.supports("(--foo: red)"))}function se(e){var t;return "r"===e.charAt(0)?e=(t=(t=e).match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i))&&4===t.length?"#"+("0"+parseInt(t[1],10).toString(16)).slice(-2)+("0"+parseInt(t[2],10).toString(16)).slice(-2)+("0"+parseInt(t[3],10).toString(16)).slice(-2):"":"transparent"===e.toLowerCase()&&(e="#00000000"),e}const{document:re}=globals;function ae(e){let t;return {c(){t=element("div"),attr(t,"class","ripple svelte-po4fcb");},m(n,l){insert(n,t,l),e[5](t);},p:noop,i:noop,o:noop,d(n){n&&detach(t),e[5](null);}}}function ce(e,t){e.style.transform=t,e.style.webkitTransform=t;}function de(e,t){e.style.opacity=t.toString();}const ue=function(e,t){const n=["touchcancel","mouseleave","dragstart"];let l=t.currentTarget||t.target;if(l&&!l.classList.contains("ripple")&&(l=l.querySelector(".ripple")),!l)return;const o=l.dataset.event;if(o&&o!==e)return;l.dataset.event=e;const i=document.createElement("span"),{radius:s,scale:r,x:a,y:c,centerX:d,centerY:u}=((e,t)=>{const n=t.getBoundingClientRect(),l=function(e){return "TouchEvent"===e.constructor.name}(e)?e.touches[e.touches.length-1]:e,o=l.clientX-n.left,i=l.clientY-n.top;let s=0,r=.3;const a=t.dataset.center;t.dataset.circle?(r=.15,s=t.clientWidth/2,s=a?s:s+Math.sqrt((o-s)**2+(i-s)**2)/4):s=Math.sqrt(t.clientWidth**2+t.clientHeight**2)/2;const c=(t.clientWidth-2*s)/2+"px",d=(t.clientHeight-2*s)/2+"px";return {radius:s,scale:r,x:a?c:o-s+"px",y:a?d:i-s+"px",centerX:c,centerY:d}})(t,l),p=l.dataset.color,f=2*s+"px";i.className="animation",i.style.width=f,i.style.height=f,i.style.background=p,i.classList.add("animation--enter"),i.classList.add("animation--visible"),ce(i,`translate(${a}, ${c}) scale3d(${r},${r},${r})`),de(i,0),i.dataset.activated=String(performance.now()),l.appendChild(i),setTimeout(()=>{i.classList.remove("animation--enter"),i.classList.add("animation--in"),ce(i,`translate(${d}, ${u}) scale3d(1,1,1)`),de(i,.25);},0);const v="mousedown"===e?"mouseup":"touchend",h=function(){document.removeEventListener(v,h),n.forEach(e=>{document.removeEventListener(e,h);});const e=performance.now()-Number(i.dataset.activated),t=Math.max(250-e,0);setTimeout(()=>{i.classList.remove("animation--in"),i.classList.add("animation--out"),de(i,0),setTimeout(()=>{i&&l.removeChild(i),0===l.children.length&&delete l.dataset.event;},300);},t);};document.addEventListener(v,h),n.forEach(e=>{document.addEventListener(e,h,{passive:!0});});},pe=function(e){0===e.button&&ue(e.type,e);},fe=function(e){if(e.changedTouches)for(let t=0;t<e.changedTouches.length;++t)ue(e.type,e.changedTouches[t]);};function ve(e,t,n){let l,o,{center:i=!1}=t,{circle:s=!1}=t,{color:r="currentColor"}=t;return onMount(async()=>{await tick();try{i&&n(0,l.dataset.center="true",l),s&&n(0,l.dataset.circle="true",l),n(0,l.dataset.color=r,l),o=l.parentElement;}catch(e){}if(!o)return void console.error("Ripple: Trigger element not found.");let e=window.getComputedStyle(o);0!==e.position.length&&"static"!==e.position||(o.style.position="relative"),o.addEventListener("touchstart",fe,{passive:!0}),o.addEventListener("mousedown",pe,{passive:!0});}),onDestroy(()=>{o&&(o.removeEventListener("mousedown",pe),o.removeEventListener("touchstart",fe));}),e.$set=e=>{"center"in e&&n(1,i=e.center),"circle"in e&&n(2,s=e.circle),"color"in e&&n(3,r=e.color);},[l,i,s,r,o,function(e){binding_callbacks[e?"unshift":"push"](()=>{n(0,l=e);});}]}class he extends SvelteComponent{constructor(e){var t;super(),re.getElementById("svelte-po4fcb-style")||((t=element("style")).id="svelte-po4fcb-style",t.textContent=".ripple.svelte-po4fcb{display:block;position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;border-radius:inherit;color:inherit;pointer-events:none;z-index:0;contain:strict}.ripple.svelte-po4fcb .animation{color:inherit;position:absolute;top:0;left:0;border-radius:50%;opacity:0;pointer-events:none;overflow:hidden;will-change:transform, opacity}.ripple.svelte-po4fcb .animation--enter{transition:none}.ripple.svelte-po4fcb .animation--in{transition:opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1);transition:transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),\n\t\t\topacity 0.1s cubic-bezier(0.4, 0, 0.2, 1)}.ripple.svelte-po4fcb .animation--out{transition:opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)}",append(re.head,t)),init(this,e,ve,ae,safe_not_equal,{center:1,circle:2,color:3});}}function ge(e){let t;const n=new he({props:{center:e[3],circle:e[3]}});return {c(){create_component(n.$$.fragment);},m(e,l){mount_component(n,e,l),t=!0;},p(e,t){const l={};8&t&&(l.center=e[3]),8&t&&(l.circle=e[3]),n.$set(l);},i(e){t||(transition_in(n.$$.fragment,e),t=!0);},o(e){transition_out(n.$$.fragment,e),t=!1;},d(e){destroy_component(n,e);}}}function me(t){let n,l,o,i,a,d;const p=t[22].default,v=create_slot(p,t,t[21],null);let h=t[10]&&ge(t),b=[{class:t[1]},{style:t[2]},t[14]],E={};for(let e=0;e<b.length;e+=1)E=assign(E,b[e]);return {c(){n=element("button"),v&&v.c(),l=space(),h&&h.c(),set_attributes(n,E),toggle_class(n,"raised",t[6]),toggle_class(n,"outlined",t[8]&&!(t[6]||t[7])),toggle_class(n,"shaped",t[9]&&!t[3]),toggle_class(n,"dense",t[5]),toggle_class(n,"fab",t[4]&&t[3]),toggle_class(n,"icon-button",t[3]),toggle_class(n,"toggle",t[11]),toggle_class(n,"active",t[11]&&t[0]),toggle_class(n,"full-width",t[12]&&!t[3]),toggle_class(n,"svelte-6bcb3a",!0);},m(s,u){insert(s,n,u),v&&v.m(n,null),append(n,l),h&&h.m(n,null),t[23](n),i=!0,a||(d=[listen(n,"click",t[16]),action_destroyer(o=t[15].call(null,n))],a=!0);},p(e,[t]){v&&v.p&&2097152&t&&update_slot(v,p,e,e[21],t,null,null),e[10]?h?(h.p(e,t),1024&t&&transition_in(h,1)):(h=ge(e),h.c(),transition_in(h,1),h.m(n,null)):h&&(group_outros(),transition_out(h,1,1,()=>{h=null;}),check_outros()),set_attributes(n,E=get_spread_update(b,[2&t&&{class:e[1]},4&t&&{style:e[2]},16384&t&&e[14]])),toggle_class(n,"raised",e[6]),toggle_class(n,"outlined",e[8]&&!(e[6]||e[7])),toggle_class(n,"shaped",e[9]&&!e[3]),toggle_class(n,"dense",e[5]),toggle_class(n,"fab",e[4]&&e[3]),toggle_class(n,"icon-button",e[3]),toggle_class(n,"toggle",e[11]),toggle_class(n,"active",e[11]&&e[0]),toggle_class(n,"full-width",e[12]&&!e[3]),toggle_class(n,"svelte-6bcb3a",!0);},i(e){i||(transition_in(v,e),transition_in(h),i=!0);},o(e){transition_out(v,e),transition_out(h),i=!1;},d(e){e&&detach(n),v&&v.d(e),h&&h.d(),t[23](null),a=!1,run_all(d);}}}function be(e,t,n){const l=createEventDispatcher(),o=oe(current_component);let i,{class:s=""}=t,{style:r=null}=t,{icon:a=!1}=t,{fab:c=!1}=t,{dense:d=!1}=t,{raised:u=!1}=t,{unelevated:f=!1}=t,{outlined:v=!1}=t,{shaped:h=!1}=t,{color:g=null}=t,{ripple:m=!0}=t,{toggle:b=!1}=t,{active:x=!1}=t,{fullWidth:w=!1}=t,$={};beforeUpdate(()=>{if(!i)return;let e=i.getElementsByTagName("svg"),t=e.length;for(let n=0;n<t;n++)e[n].setAttribute("width",z+(b&&!a?2:0)),e[n].setAttribute("height",z+(b&&!a?2:0));n(13,i.style.backgroundColor=u||f?g:"transparent",i);let l=getComputedStyle(i).getPropertyValue("background-color");n(13,i.style.color=u||f?function(e="#ffffff"){let t,n,l,o,i,s;if(0===e.length&&(e="#ffffff"),e=se(e),e=String(e).replace(/[^0-9a-f]/gi,""),!new RegExp(/^(?:[0-9a-f]{3}){1,2}$/i).test(e))throw new Error("Invalid HEX color!");e.length<6&&(e=e[0]+e[0]+e[1]+e[1]+e[2]+e[2]);const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(e);return t=parseInt(r[1],16)/255,n=parseInt(r[2],16)/255,l=parseInt(r[3],16)/255,o=t<=.03928?t/12.92:Math.pow((t+.055)/1.055,2.4),i=n<=.03928?n/12.92:Math.pow((n+.055)/1.055,2.4),s=l<=.03928?l/12.92:Math.pow((l+.055)/1.055,2.4),.2126*o+.7152*i+.0722*s}(l)>.5?"#000":"#fff":g,i);});let z,{$$slots:k={},$$scope:D}=t;return e.$set=e=>{n(20,t=assign(assign({},t),exclude_internal_props(e))),"class"in e&&n(1,s=e.class),"style"in e&&n(2,r=e.style),"icon"in e&&n(3,a=e.icon),"fab"in e&&n(4,c=e.fab),"dense"in e&&n(5,d=e.dense),"raised"in e&&n(6,u=e.raised),"unelevated"in e&&n(7,f=e.unelevated),"outlined"in e&&n(8,v=e.outlined),"shaped"in e&&n(9,h=e.shaped),"color"in e&&n(17,g=e.color),"ripple"in e&&n(10,m=e.ripple),"toggle"in e&&n(11,b=e.toggle),"active"in e&&n(0,x=e.active),"fullWidth"in e&&n(12,w=e.fullWidth),"$$scope"in e&&n(21,D=e.$$scope);},e.$$.update=()=>{{const{style:e,icon:l,fab:o,dense:i,raised:s,unelevated:r,outlined:a,shaped:c,color:d,ripple:u,toggle:p,active:f,fullWidth:v,...h}=t;!h.disabled&&delete h.disabled,delete h.class,n(14,$=h);}56&e.$$.dirty&&(z=a?c?24:d?20:24:d?16:18),139264&e.$$.dirty&&("primary"===g?n(17,g=ie()?"#1976d2":"var(--primary, #1976d2)"):"accent"==g?n(17,g=ie()?"#f50057":"var(--accent, #f50057)"):!g&&i&&n(17,g=i.style.color||i.parentElement.style.color||(ie()?"#333":"var(--color, #333)")));},t=exclude_internal_props(t),[x,s,r,a,c,d,u,f,v,h,m,b,w,i,$,o,function(e){b&&(n(0,x=!x),l("change",x));},g,z,l,t,D,k,function(e){binding_callbacks[e?"unshift":"push"](()=>{n(13,i=e);});}]}class ye extends SvelteComponent{constructor(e){var t;super(),document.getElementById("svelte-6bcb3a-style")||((t=element("style")).id="svelte-6bcb3a-style",t.textContent="button.svelte-6bcb3a:disabled{cursor:default}button.svelte-6bcb3a{cursor:pointer;font-family:Roboto, Helvetica, sans-serif;font-family:var(--button-font-family, Roboto, Helvetica, sans-serif);font-size:0.875rem;font-weight:500;letter-spacing:0.75px;text-decoration:none;text-transform:uppercase;will-change:transform, opacity;margin:0;padding:0 16px;display:-ms-inline-flexbox;display:inline-flex;position:relative;align-items:center;justify-content:center;box-sizing:border-box;height:36px;border:none;outline:none;line-height:inherit;user-select:none;overflow:hidden;vertical-align:middle;border-radius:4px}button.svelte-6bcb3a::-moz-focus-inner{border:0}button.svelte-6bcb3a:-moz-focusring{outline:none}button.svelte-6bcb3a:before{box-sizing:inherit;border-radius:inherit;color:inherit;bottom:0;content:'';left:0;opacity:0;pointer-events:none;position:absolute;right:0;top:0;transition:0.2s cubic-bezier(0.25, 0.8, 0.5, 1);will-change:background-color, opacity}.toggle.svelte-6bcb3a:before{box-sizing:content-box}.active.svelte-6bcb3a:before{background-color:currentColor;opacity:0.3}.raised.svelte-6bcb3a{box-shadow:0 3px 1px -2px rgba(0, 0, 0, 0.2), 0 2px 2px 0 rgba(0, 0, 0, 0.14),\n\t\t\t0 1px 5px 0 rgba(0, 0, 0, 0.12)}.outlined.svelte-6bcb3a{padding:0 14px;border-style:solid;border-width:2px}.shaped.svelte-6bcb3a{border-radius:18px}.dense.svelte-6bcb3a{height:32px}.icon-button.svelte-6bcb3a{line-height:0.5;border-radius:50%;padding:8px;width:40px;height:40px;vertical-align:middle}.icon-button.outlined.svelte-6bcb3a{padding:6px}.icon-button.fab.svelte-6bcb3a{border:none;width:56px;height:56px;box-shadow:0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14),\n\t\t\t0 1px 18px 0 rgba(0, 0, 0, 0.12)}.icon-button.dense.svelte-6bcb3a{width:36px;height:36px}.icon-button.fab.dense.svelte-6bcb3a{width:40px;height:40px}.outlined.svelte-6bcb3a:not(.shaped) .ripple{border-radius:0 !important}.full-width.svelte-6bcb3a{width:100%}@media(hover: hover){button.svelte-6bcb3a:hover:not(.toggle):not([disabled]):not(.disabled):before{background-color:currentColor;opacity:0.15}button.focus-visible.svelte-6bcb3a:focus:not(.toggle):not([disabled]):not(.disabled):before{background-color:currentColor;opacity:0.3}button.focus-visible.toggle.svelte-6bcb3a:focus:not(.active):not([disabled]):not(.disabled):before{background-color:currentColor;opacity:0.15}}",append(document.head,t)),init(this,e,be,me,safe_not_equal,{class:1,style:2,icon:3,fab:4,dense:5,raised:6,unelevated:7,outlined:8,shaped:9,color:17,ripple:10,toggle:11,active:0,fullWidth:12});}}function ze(e){let t;const n=e[13].default,l=create_slot(n,e,e[12],null);return {c(){l&&l.c();},m(e,n){l&&l.m(e,n),t=!0;},p(e,t){l&&l.p&&4096&t&&update_slot(l,n,e,e[12],t,null,null);},i(e){t||(transition_in(l,e),t=!0);},o(e){transition_out(l,e),t=!1;},d(e){l&&l.d(e);}}}function ke(e){let t,n;return {c(){t=svg_element("svg"),n=svg_element("path"),attr(n,"d",e[1]),attr(t,"xmlns","http://www.w3.org/2000/svg"),attr(t,"viewBox",e[2]),attr(t,"class","svelte-h2unzw");},m(e,l){insert(e,t,l),append(t,n);},p(e,l){2&l&&attr(n,"d",e[1]),4&l&&attr(t,"viewBox",e[2]);},i:noop,o:noop,d(e){e&&detach(t);}}}function De(e){let t,n,l,o,i,r,a;const d=[ke,ze],p=[];function f(e,t){return "string"==typeof e[1]?0:1}n=f(e),l=p[n]=d[n](e);let v=[{class:"icon "+e[0]},e[7]],h={};for(let e=0;e<v.length;e+=1)h=assign(h,v[e]);return {c(){t=element("i"),l.c(),set_attributes(t,h),toggle_class(t,"flip",e[3]&&"boolean"==typeof e[3]),toggle_class(t,"flip-h","h"===e[3]),toggle_class(t,"flip-v","v"===e[3]),toggle_class(t,"spin",e[4]),toggle_class(t,"pulse",e[5]&&!e[4]),toggle_class(t,"svelte-h2unzw",!0);},m(l,s){insert(l,t,s),p[n].m(t,null),e[14](t),i=!0,r||(a=action_destroyer(o=e[8].call(null,t)),r=!0);},p(e,[o]){let i=n;n=f(e),n===i?p[n].p(e,o):(group_outros(),transition_out(p[i],1,1,()=>{p[i]=null;}),check_outros(),l=p[n],l||(l=p[n]=d[n](e),l.c()),transition_in(l,1),l.m(t,null)),set_attributes(t,h=get_spread_update(v,[1&o&&{class:"icon "+e[0]},128&o&&e[7]])),toggle_class(t,"flip",e[3]&&"boolean"==typeof e[3]),toggle_class(t,"flip-h","h"===e[3]),toggle_class(t,"flip-v","v"===e[3]),toggle_class(t,"spin",e[4]),toggle_class(t,"pulse",e[5]&&!e[4]),toggle_class(t,"svelte-h2unzw",!0);},i(e){i||(transition_in(l),i=!0);},o(e){transition_out(l),i=!1;},d(l){l&&detach(t),p[n].d(),e[14](null),r=!1,a();}}}function Ce(e,t,n){const l=oe(current_component);let o,{class:i=""}=t,{path:s=null}=t,{size:r=24}=t,{viewBox:a="0 0 24 24"}=t,{color:c="currentColor"}=t,{flip:d=!1}=t,{spin:u=!1}=t,{pulse:f=!1}=t,v={},{$$slots:h={},$$scope:g}=t;return e.$set=e=>{n(11,t=assign(assign({},t),exclude_internal_props(e))),"class"in e&&n(0,i=e.class),"path"in e&&n(1,s=e.path),"size"in e&&n(9,r=e.size),"viewBox"in e&&n(2,a=e.viewBox),"color"in e&&n(10,c=e.color),"flip"in e&&n(3,d=e.flip),"spin"in e&&n(4,u=e.spin),"pulse"in e&&n(5,f=e.pulse),"$$scope"in e&&n(12,g=e.$$scope);},e.$$.update=()=>{{const{path:e,size:l,viewBox:o,color:i,flip:s,spin:r,pulse:a,...c}=t;delete c.class,n(7,v=c);}1600&e.$$.dirty&&o&&(o.firstChild.setAttribute("width",r),o.firstChild.setAttribute("height",r),c&&o.firstChild.setAttribute("fill",c));},t=exclude_internal_props(t),[i,s,a,d,u,f,o,v,l,r,c,t,g,h,function(e){binding_callbacks[e?"unshift":"push"](()=>{n(6,o=e);});}]}class Me extends SvelteComponent{constructor(e){var t;super(),document.getElementById("svelte-h2unzw-style")||((t=element("style")).id="svelte-h2unzw-style",t.textContent=".icon.svelte-h2unzw.svelte-h2unzw{display:inline-block;position:relative;vertical-align:middle;line-height:0.5}.icon.svelte-h2unzw>svg.svelte-h2unzw{display:inline-block}.flip.svelte-h2unzw.svelte-h2unzw{transform:scale(-1, -1)}.flip-h.svelte-h2unzw.svelte-h2unzw{transform:scale(-1, 1)}.flip-v.svelte-h2unzw.svelte-h2unzw{transform:scale(1, -1)}.spin.svelte-h2unzw.svelte-h2unzw{animation:svelte-h2unzw-spin 1s 0s infinite linear}.pulse.svelte-h2unzw.svelte-h2unzw{animation:svelte-h2unzw-spin 1s infinite steps(8)}@keyframes svelte-h2unzw-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}",append(document.head,t)),init(this,e,Ce,De,safe_not_equal,{class:0,path:1,size:9,viewBox:2,color:10,flip:3,spin:4,pulse:5});}}function Le(e){let t;const n=new he({props:{center:!0,circle:!0}});return {c(){create_component(n.$$.fragment);},m(e,l){mount_component(n,e,l),t=!0;},i(e){t||(transition_in(n.$$.fragment,e),t=!0);},o(e){transition_out(n.$$.fragment,e),t=!1;},d(e){destroy_component(n,e);}}}function Ee(t){let n,l,o,i,d,p,E,Y,j,N,B,I,F,S=[{type:"checkbox"},{__value:t[9]},t[10]],q={};for(let e=0;e<S.length;e+=1)q=assign(q,S[e]);const _=new Me({props:{path:t[2]?Ae:t[0]?Ye:je}});let H=t[7]&&Le();const O=t[17].default,P=create_slot(O,t,t[16],null);return {c(){n=element("label"),l=element("input"),i=space(),d=element("div"),create_component(_.$$.fragment),p=space(),H&&H.c(),Y=space(),j=element("div"),P&&P.c(),set_attributes(l,q),void 0!==t[0]&&void 0!==t[2]||add_render_callback(()=>t[18].call(l)),toggle_class(l,"svelte-1idh7xl",!0),attr(d,"class","mark svelte-1idh7xl"),attr(d,"style",E="color: "+(t[2]||t[0]?t[1]:"#9a9a9a")),attr(j,"class","label-text svelte-1idh7xl"),attr(n,"class",N=null_to_empty(t[3])+" svelte-1idh7xl"),attr(n,"style",t[4]),attr(n,"title",t[8]),toggle_class(n,"right",t[6]),toggle_class(n,"disabled",t[5]);},m(s,a){insert(s,n,a),append(n,l),l.checked=t[0],l.indeterminate=t[2],append(n,i),append(n,d),mount_component(_,d,null),append(d,p),H&&H.m(d,null),append(n,Y),append(n,j),P&&P.m(j,null),B=!0,I||(F=[listen(l,"change",t[18]),listen(l,"change",t[12]),action_destroyer(o=t[11].call(null,l))],I=!0);},p(e,[t]){set_attributes(l,q=get_spread_update(S,[{type:"checkbox"},512&t&&{__value:e[9]},1024&t&&e[10]])),1&t&&(l.checked=e[0]),4&t&&(l.indeterminate=e[2]),toggle_class(l,"svelte-1idh7xl",!0);const o={};5&t&&(o.path=e[2]?Ae:e[0]?Ye:je),_.$set(o),e[7]?H?128&t&&transition_in(H,1):(H=Le(),H.c(),transition_in(H,1),H.m(d,null)):H&&(group_outros(),transition_out(H,1,1,()=>{H=null;}),check_outros()),(!B||7&t&&E!==(E="color: "+(e[2]||e[0]?e[1]:"#9a9a9a")))&&attr(d,"style",E),P&&P.p&&65536&t&&update_slot(P,O,e,e[16],t,null,null),(!B||8&t&&N!==(N=null_to_empty(e[3])+" svelte-1idh7xl"))&&attr(n,"class",N),(!B||16&t)&&attr(n,"style",e[4]),(!B||256&t)&&attr(n,"title",e[8]),72&t&&toggle_class(n,"right",e[6]),40&t&&toggle_class(n,"disabled",e[5]);},i(e){B||(transition_in(_.$$.fragment,e),transition_in(H),transition_in(P,e),B=!0);},o(e){transition_out(_.$$.fragment,e),transition_out(H),transition_out(P,e),B=!1;},d(e){e&&detach(n),destroy_component(_),H&&H.d(),P&&P.d(e),I=!1,run_all(F);}}}let Ye="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",je="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z",Ae="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z";function Te(e,t,n){const l=oe(current_component);let{checked:o=!1}=t,{class:i=""}=t,{style:s=null}=t,{color:r="primary"}=t,{disabled:a=!1}=t,{group:c=null}=t,{indeterminate:d=!1}=t,{right:u=!1}=t,{ripple:p=!0}=t,{title:f=null}=t,{value:v="on"}=t,h={};function g(){setTimeout(()=>{n(0,o=c.indexOf(v)>=0);},0);}let{$$slots:m={},$$scope:b}=t;return e.$set=e=>{n(15,t=assign(assign({},t),exclude_internal_props(e))),"checked"in e&&n(0,o=e.checked),"class"in e&&n(3,i=e.class),"style"in e&&n(4,s=e.style),"color"in e&&n(1,r=e.color),"disabled"in e&&n(5,a=e.disabled),"group"in e&&n(13,c=e.group),"indeterminate"in e&&n(2,d=e.indeterminate),"right"in e&&n(6,u=e.right),"ripple"in e&&n(7,p=e.ripple),"title"in e&&n(8,f=e.title),"value"in e&&n(9,v=e.value),"$$scope"in e&&n(16,b=e.$$scope);},e.$$.update=()=>{{const{checked:e,style:l,color:o,group:i,indeterminate:s,right:r,ripple:a,title:c,value:d,...u}=t;!u.disabled&&delete u.disabled,delete u.class,n(10,h=u);}8192&e.$$.dirty&&null!==c&&g(),2&e.$$.dirty&&("primary"!==r&&r?"accent"===r&&n(1,r=ie()?"#f50057":"var(--accent, #f50057)"):n(1,r=ie()?"#1976d2":"var(--primary, #1976d2)"));},t=exclude_internal_props(t),[o,r,d,i,s,a,u,p,f,v,h,l,function(){if(null!==c){let e=c.indexOf(v);o?e<0&&c.push(v):e>=0&&c.splice(e,1),n(13,c);}},c,g,t,b,m,function(){o=this.checked,d=this.indeterminate,n(0,o),n(2,d);}]}class Ne extends SvelteComponent{constructor(e){var t;super(),document.getElementById("svelte-1idh7xl-style")||((t=element("style")).id="svelte-1idh7xl-style",t.textContent="label.svelte-1idh7xl.svelte-1idh7xl{width:100%;align-items:center;display:flex;margin:0;position:relative;cursor:pointer;line-height:40px;user-select:none}input.svelte-1idh7xl.svelte-1idh7xl{cursor:inherit;width:100%;height:100%;position:absolute;top:0;left:0;margin:0;padding:0;opacity:0 !important}.mark.svelte-1idh7xl.svelte-1idh7xl{display:flex;position:relative;justify-content:center;align-items:center;border-radius:50%;width:40px;height:40px}.mark.svelte-1idh7xl.svelte-1idh7xl:before{background-color:currentColor;border-radius:inherit;bottom:0;color:inherit;content:'';left:0;opacity:0;pointer-events:none;position:absolute;right:0;top:0;transition:0.3s cubic-bezier(0.25, 0.8, 0.5, 1)}@media not all and (min-resolution: 0.001dpcm){@supports (-webkit-appearance: none) and (stroke-color: transparent){.mark.svelte-1idh7xl.svelte-1idh7xl:before{transition:none}}}.label-text.svelte-1idh7xl.svelte-1idh7xl{margin-left:4px;white-space:nowrap;overflow:hidden}.right.svelte-1idh7xl .label-text.svelte-1idh7xl{margin-left:0;margin-right:auto;order:-1}@media(hover: hover){label.svelte-1idh7xl:hover:not([disabled]):not(.disabled) .mark.svelte-1idh7xl:before{opacity:0.15}.focus-visible:focus:not([disabled]):not(.disabled)~.mark.svelte-1idh7xl.svelte-1idh7xl:before{opacity:0.3}}",append(document.head,t)),init(this,e,Te,Ee,safe_not_equal,{checked:0,class:3,style:4,color:1,disabled:5,group:13,indeterminate:2,right:6,ripple:7,title:8,value:9});}}function He(e){let t;return {c(){t=element("span"),t.textContent="*",attr(t,"class","required svelte-1dzu4e7");},m(e,n){insert(e,t,n);},d(e){e&&detach(t);}}}function Oe(e){let t,n,l;return {c(){t=element("div"),n=space(),l=element("div"),attr(t,"class","input-line svelte-1dzu4e7"),attr(l,"class","focus-line svelte-1dzu4e7");},m(e,o){insert(e,t,o),insert(e,n,o),insert(e,l,o);},d(e){e&&detach(t),e&&detach(n),e&&detach(l);}}}function Pe(e){let t,n,l,o=(e[11]||e[10])+"";return {c(){t=element("div"),n=element("div"),l=text(o),attr(n,"class","message"),attr(t,"class","help svelte-1dzu4e7"),toggle_class(t,"persist",e[9]),toggle_class(t,"error",e[11]);},m(e,o){insert(e,t,o),append(t,n),append(n,l);},p(e,n){3072&n&&o!==(o=(e[11]||e[10])+"")&&set_data(l,o),512&n&&toggle_class(t,"persist",e[9]),2048&n&&toggle_class(t,"error",e[11]);},d(e){e&&detach(t);}}}function We(t){let n,l,o,i,p,f,v,h,g,m,b,k,D,C,E=[{class:"input"},t[12]],Y={};for(let e=0;e<E.length;e+=1)Y=assign(Y,E[e]);let j=t[2]&&!t[0].length&&He(),A=(!t[7]||t[8])&&Oe(),F=(!!t[10]||!!t[11])&&Pe(t);return {c(){n=element("div"),l=element("input"),i=space(),p=element("div"),f=space(),v=element("div"),h=text(t[6]),g=space(),j&&j.c(),m=space(),A&&A.c(),b=space(),F&&F.c(),set_attributes(l,Y),toggle_class(l,"svelte-1dzu4e7",!0),attr(p,"class","focus-ring svelte-1dzu4e7"),attr(v,"class","label svelte-1dzu4e7"),attr(n,"class",k=null_to_empty(`text-field ${t[7]&&!t[8]?"outlined":"baseline"} ${t[3]}`)+" svelte-1dzu4e7"),attr(n,"style",t[4]),attr(n,"title",t[5]),toggle_class(n,"filled",t[8]),toggle_class(n,"dirty",t[13]),toggle_class(n,"disabled",t[1]);},m(s,a){insert(s,n,a),append(n,l),set_input_value(l,t[0]),append(n,i),append(n,p),append(n,f),append(n,v),append(v,h),append(v,g),j&&j.m(v,null),append(n,m),A&&A.m(n,null),append(n,b),F&&F.m(n,null),D||(C=[listen(l,"input",t[19]),action_destroyer(o=t[14].call(null,l))],D=!0);},p(e,[t]){set_attributes(l,Y=get_spread_update(E,[{class:"input"},4096&t&&e[12]])),1&t&&l.value!==e[0]&&set_input_value(l,e[0]),toggle_class(l,"svelte-1dzu4e7",!0),64&t&&set_data(h,e[6]),e[2]&&!e[0].length?j||(j=He(),j.c(),j.m(v,null)):j&&(j.d(1),j=null),!e[7]||e[8]?A||(A=Oe(),A.c(),A.m(n,b)):A&&(A.d(1),A=null),e[10]||e[11]?F?F.p(e,t):(F=Pe(e),F.c(),F.m(n,null)):F&&(F.d(1),F=null),392&t&&k!==(k=null_to_empty(`text-field ${e[7]&&!e[8]?"outlined":"baseline"} ${e[3]}`)+" svelte-1dzu4e7")&&attr(n,"class",k),16&t&&attr(n,"style",e[4]),32&t&&attr(n,"title",e[5]),392&t&&toggle_class(n,"filled",e[8]),8584&t&&toggle_class(n,"dirty",e[13]),394&t&&toggle_class(n,"disabled",e[1]);},i:noop,o:noop,d(e){e&&detach(n),j&&j.d(),A&&A.d(),F&&F.d(),D=!1,run_all(C);}}}function Xe(e,t,n){const l=oe(current_component);let o,{value:i=""}=t,{disabled:s=!1}=t,{required:r=!1}=t,{class:a=""}=t,{style:c=null}=t,{title:d=null}=t,{label:u=""}=t,{outlined:p=!1}=t,{filled:f=!1}=t,{messagePersist:v=!1}=t,{message:h=""}=t,{error:g=""}=t,m={};const b=["date","datetime-local","email","month","number","password","search","tel","text","time","url","week"],x=["date","datetime-local","month","time","week"];let w;return e.$set=e=>{n(18,t=assign(assign({},t),exclude_internal_props(e))),"value"in e&&n(0,i=e.value),"disabled"in e&&n(1,s=e.disabled),"required"in e&&n(2,r=e.required),"class"in e&&n(3,a=e.class),"style"in e&&n(4,c=e.style),"title"in e&&n(5,d=e.title),"label"in e&&n(6,u=e.label),"outlined"in e&&n(7,p=e.outlined),"filled"in e&&n(8,f=e.filled),"messagePersist"in e&&n(9,v=e.messagePersist),"message"in e&&n(10,h=e.message),"error"in e&&n(11,g=e.error);},e.$$.update=()=>{{const{value:e,style:l,title:i,label:s,outlined:r,filled:a,messagePersist:c,message:d,error:u,...p}=t;!p.readonly&&delete p.readonly,!p.disabled&&delete p.disabled,delete p.class,p.type=b.indexOf(p.type)<0?"text":p.type,n(15,o=p.placeholder),n(12,m=p);}36865&e.$$.dirty&&n(13,w="string"==typeof i&&i.length>0||"number"==typeof i||o||x.indexOf(m.type)>=0);},t=exclude_internal_props(t),[i,s,r,a,c,d,u,p,f,v,h,g,m,w,l,o,b,x,t,function(){i=this.value,n(0,i);}]}class Ve extends SvelteComponent{constructor(e){var t;super(),document.getElementById("svelte-1dzu4e7-style")||((t=element("style")).id="svelte-1dzu4e7-style",t.textContent=".text-field.svelte-1dzu4e7.svelte-1dzu4e7{font-family:Roboto, 'Segoe UI', sans-serif;font-weight:400;font-size:inherit;text-decoration:inherit;text-transform:inherit;box-sizing:border-box;margin:0 0 20px;position:relative;width:100%;background-color:inherit;will-change:opacity, transform, color}.outlined.svelte-1dzu4e7.svelte-1dzu4e7{margin-top:12px}.required.svelte-1dzu4e7.svelte-1dzu4e7{position:relative;top:0.175em;left:0.125em;color:#ff5252}.input.svelte-1dzu4e7.svelte-1dzu4e7{box-sizing:border-box;font:inherit;width:100%;min-height:32px;background:none;text-align:left;color:#333;color:var(--color, #333);caret-color:#1976d2;caret-color:var(--primary, #1976d2);border:none;margin:0;padding:2px 0 0;outline:none}.input.svelte-1dzu4e7.svelte-1dzu4e7::placeholder{color:rgba(0, 0, 0, 0.3755);color:var(--label, rgba(0, 0, 0, 0.3755));font-weight:100}.input.svelte-1dzu4e7.svelte-1dzu4e7::-moz-focus-inner{padding:0;border:0}.input.svelte-1dzu4e7.svelte-1dzu4e7:-moz-focusring{outline:none}.input.svelte-1dzu4e7.svelte-1dzu4e7:required{box-shadow:none}.input.svelte-1dzu4e7.svelte-1dzu4e7:invalid{box-shadow:none}.input.svelte-1dzu4e7.svelte-1dzu4e7:active{outline:none}.input:hover~.input-line.svelte-1dzu4e7.svelte-1dzu4e7{background:#333;background:var(--color, #333)}.label.svelte-1dzu4e7.svelte-1dzu4e7{font:inherit;display:inline-flex;position:absolute;left:0;top:28px;padding-right:0.2em;color:rgba(0, 0, 0, 0.3755);color:var(--label, rgba(0, 0, 0, 0.3755));background-color:inherit;pointer-events:none;-webkit-backface-visibility:hidden;backface-visibility:hidden;overflow:hidden;max-width:90%;white-space:nowrap;transform-origin:left top;transition:0.18s cubic-bezier(0.25, 0.8, 0.5, 1)}.focus-ring.svelte-1dzu4e7.svelte-1dzu4e7{pointer-events:none;margin:0;padding:0;border:2px solid transparent;border-radius:4px;position:absolute;left:0;top:0;right:0;bottom:0}.input-line.svelte-1dzu4e7.svelte-1dzu4e7{position:absolute;left:0;right:0;bottom:0;margin:0;height:1px;background:rgba(0, 0, 0, 0.3755);background:var(--label, rgba(0, 0, 0, 0.3755))}.focus-line.svelte-1dzu4e7.svelte-1dzu4e7{position:absolute;bottom:0;left:0;right:0;height:2px;-webkit-transform:scaleX(0);transform:scaleX(0);transition:transform 0.18s cubic-bezier(0.4, 0, 0.2, 1),\n\t\t\topacity 0.18s cubic-bezier(0.4, 0, 0.2, 1),\n\t\t\t-webkit-transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);transition:transform 0.18s cubic-bezier(0.4, 0, 0.2, 1),\n\t\t\topacity 0.18s cubic-bezier(0.4, 0, 0.2, 1);opacity:0;z-index:2;background:#1976d2;background:var(--primary, #1976d2)}.help.svelte-1dzu4e7.svelte-1dzu4e7{position:absolute;left:0;right:0;bottom:-18px;display:flex;justify-content:space-between;font-size:12px;line-height:normal;letter-spacing:0.4px;color:rgba(0, 0, 0, 0.3755);color:var(--label, rgba(0, 0, 0, 0.3755));opacity:0;overflow:hidden;max-width:90%;white-space:nowrap}.persist.svelte-1dzu4e7.svelte-1dzu4e7,.error.svelte-1dzu4e7.svelte-1dzu4e7,.input:focus~.help.svelte-1dzu4e7.svelte-1dzu4e7{opacity:1}.error.svelte-1dzu4e7.svelte-1dzu4e7{color:#ff5252}.baseline.dirty.svelte-1dzu4e7 .label.svelte-1dzu4e7{letter-spacing:0.4px;top:6px;bottom:unset;font-size:13px}.baseline .input:focus~.label.svelte-1dzu4e7.svelte-1dzu4e7{letter-spacing:0.4px;top:6px;bottom:unset;font-size:13px;color:#1976d2;color:var(--primary, #1976d2)}.baseline .input:focus~.focus-line.svelte-1dzu4e7.svelte-1dzu4e7{transform:scaleX(1);opacity:1}.baseline.svelte-1dzu4e7 .input.svelte-1dzu4e7{height:52px;padding-top:22px}.baseline.filled.svelte-1dzu4e7.svelte-1dzu4e7{background:rgba(0, 0, 0, 0.0555);background:var(--bg-input-filled, rgba(0, 0, 0, 0.0555));border-radius:4px 4px 0 0}.baseline.filled.svelte-1dzu4e7 .label.svelte-1dzu4e7{background:none}.baseline.filled.svelte-1dzu4e7 .input.svelte-1dzu4e7,.baseline.filled.svelte-1dzu4e7 .label.svelte-1dzu4e7{padding-left:8px;padding-right:8px}.baseline.filled .input:focus~.label.svelte-1dzu4e7.svelte-1dzu4e7{top:6px}.baseline.filled.svelte-1dzu4e7 .help.svelte-1dzu4e7{padding-left:8px}.filled.svelte-1dzu4e7 .input.svelte-1dzu4e7:hover,.filled.svelte-1dzu4e7 .input.svelte-1dzu4e7:focus{background:rgba(0, 0, 0, 0.0555);background:var(--bg-input-filled, rgba(0, 0, 0, 0.0555))}.outlined.svelte-1dzu4e7 .help.svelte-1dzu4e7{left:18px}.outlined.svelte-1dzu4e7 .input.svelte-1dzu4e7{padding:11px 16px 9px;border-radius:4px;border:1px solid;border-color:rgba(0, 0, 0, 0.3755);border-color:var(--label, rgba(0, 0, 0, 0.3755))}.outlined.svelte-1dzu4e7 .label.svelte-1dzu4e7{top:12px;bottom:unset;left:17px}.outlined.dirty.svelte-1dzu4e7 .label.svelte-1dzu4e7{top:-6px;bottom:unset;font-size:12px;letter-spacing:0.4px;padding:0 4px;left:13px}.outlined.svelte-1dzu4e7 .input.svelte-1dzu4e7:hover{border-color:#333;border-color:var(--color, #333)}.outlined .input:focus~.label.svelte-1dzu4e7.svelte-1dzu4e7{top:-6px;bottom:unset;font-size:12px;letter-spacing:0.4px;padding:0 4px;left:13px;color:#1976d2;color:var(--primary, #1976d2)}.outlined .input:focus~.focus-ring.svelte-1dzu4e7.svelte-1dzu4e7,.outlined .input.focus-visible~.focus-ring.svelte-1dzu4e7.svelte-1dzu4e7{border-color:#1976d2;border-color:var(--primary, #1976d2)}",append(document.head,t)),init(this,e,Xe,We,safe_not_equal,{value:0,disabled:1,required:2,class:3,style:4,title:5,label:6,outlined:7,filled:8,messagePersist:9,message:10,error:11});}}function Re(e,t){if("Tab"!==e.key&&9!==e.keyCode)return;let n=function(e=document){return Array.prototype.slice.call(e.querySelectorAll('button, [href], select, textarea, input:not([type="hidden"]), [tabindex]:not([tabindex="-1"])')).filter((function(e){const t=window.getComputedStyle(e);return !e.disabled&&!e.getAttribute("disabled")&&!e.classList.contains("disabled")&&"none"!==t.display&&"hidden"!==t.visibility&&t.opacity>0}))}(t);if(0===n.length)return void e.preventDefault();let l=document.activeElement,o=n.indexOf(l);e.shiftKey?o<=0&&(n[n.length-1].focus(),e.preventDefault()):o>=n.length-1&&(n[0].focus(),e.preventDefault());}const{window:Ze}=globals;function Ue(t){let n,l,o,i,r,d,p,v;const h=t[23].default,b=create_slot(h,t,t[22],null);return {c(){n=element("div"),b&&b.c(),attr(n,"class",l=null_to_empty("popover "+t[1])+" svelte-5k22n0"),attr(n,"style",t[2]),attr(n,"tabindex","-1");},m(l,i){insert(l,n,i),b&&b.m(n,null),t[26](n),d=!0,p||(v=[listen(n,"introstart",t[24]),listen(n,"introend",t[25]),action_destroyer(o=t[4].call(null,n))],p=!0);},p(e,t){b&&b.p&&4194304&t&&update_slot(b,h,e,e[22],t,null,null),(!d||2&t&&l!==(l=null_to_empty("popover "+e[1])+" svelte-5k22n0"))&&attr(n,"class",l),(!d||4&t)&&attr(n,"style",e[2]);},i(e){d||(transition_in(b,e),add_render_callback(()=>{r&&r.end(1),i||(i=create_in_transition(n,t[5],{})),i.start();}),d=!0);},o(e){transition_out(b,e),i&&i.invalidate(),r=create_out_transition(n,t[6],{}),d=!1;},d(e){e&&detach(n),b&&b.d(e),t[26](null),e&&r&&r.end(),p=!1,run_all(v);}}}function Ge(t){let n,l,o,i,s=t[0]&&Ue(t);return {c(){s&&s.c(),n=empty();},m(r,a){s&&s.m(r,a),insert(r,n,a),l=!0,o||(i=[listen(Ze,"scroll",t[8],{passive:!0}),listen(Ze,"resize",t[9],{passive:!0}),listen(Ze,"keydown",t[10],!0),listen(Ze,"click",t[11],!0)],o=!0);},p(e,[t]){e[0]?s?(s.p(e,t),1&t&&transition_in(s,1)):(s=Ue(e),s.c(),transition_in(s,1),s.m(n.parentNode,n)):s&&(group_outros(),transition_out(s,1,1,()=>{s=null;}),check_outros());},i(e){l||(transition_in(s),l=!0);},o(e){transition_out(s),l=!1;},d(e){s&&s.d(e),e&&detach(n),o=!1,run_all(i);}}}function Ke(e,t,n){const l=oe(current_component),o=createEventDispatcher();let i,s,{class:r=""}=t,{style:a=null}=t,{origin:c="top left"}=t,{dx:d=0}=t,{dy:u=0}=t,{visible:f=!1}=t,{duration:v=300}=t;async function h({target:e}){setTimeout(()=>{e.style.transitionDuration=v+"ms",e.style.transitionProperty="opacity, transform",e.style.transform="scale(1)",e.style.opacity=null;},0);}function g(e,t){let l=0;n(12,d=+d);const o=window.innerWidth-8-e;return l=l=c.indexOf("left")>=0?t.left+d:t.left+t.width-e-d,l=Math.min(o,l),l=Math.max(8,l),l}function m(e,t){let l=0;n(13,u=+u);const o=window.innerHeight-8-e;return l=l=c.indexOf("top")>=0?t.top+u:t.top+t.height-e-u,l=Math.min(o,l),l=Math.max(8,l),l}function b(){if(!f||!i||!s)return;const e=s.getBoundingClientRect();e.top<-e.height||e.top>window.innerHeight?y("overflow"):(n(3,i.style.top=m(i.offsetHeight,e)+"px",i),n(3,i.style.left=g(i.offsetWidth,e)+"px",i));}function y(e){o("close",e),n(0,f=!1);}beforeUpdate(()=>{s=i?i.parentElement:null,s&&b();});let{$$slots:x={},$$scope:w}=t;return e.$set=e=>{"class"in e&&n(1,r=e.class),"style"in e&&n(2,a=e.style),"origin"in e&&n(14,c=e.origin),"dx"in e&&n(12,d=e.dx),"dy"in e&&n(13,u=e.dy),"visible"in e&&n(0,f=e.visible),"duration"in e&&n(15,v=e.duration),"$$scope"in e&&n(22,w=e.$$scope);},[f,r,a,i,l,function(e){return e.style.transformOrigin=c,e.style.transform="scale(0.6)",e.style.opacity="0",{duration:+v}},function(e){return e.style.transformOrigin=c,e.style.transitionDuration=v+"ms",e.style.transitionProperty="opacity, transform",e.style.transform="scale(0.6)",e.style.opacity="0",{duration:+v}},h,function(){b();},function(){b();},function(e){f&&(27===e.keyCode&&(e.stopPropagation(),y("escape")),Re(e,i));},function(e){f&&s&&!s.contains(e.target)&&(e.stopPropagation(),y("clickOutside"));},d,u,c,v,s,o,g,m,b,y,w,x,e=>h(e),e=>function({target:e}){e.style.transformOrigin=null,e.style.transitionDuration=null,e.style.transitionProperty=null,e.style.transform=null,e.focus();}(e),function(e){binding_callbacks[e?"unshift":"push"](()=>{n(3,i=e);});}]}class Je extends SvelteComponent{constructor(e){var t;super(),document.getElementById("svelte-5k22n0-style")||((t=element("style")).id="svelte-5k22n0-style",t.textContent=".popover.svelte-5k22n0{color:#333;color:var(--color, #333);background:#fff;background:var(--bg-popover, #fff);backface-visibility:hidden;position:fixed;border-radius:2px;max-height:100%;max-width:80%;overflow:auto;outline:none;box-shadow:0 3px 3px -2px rgba(0, 0, 0, 0.2), 0 3px 4px 0 rgba(0, 0, 0, 0.14),\n\t\t\t0 1px 8px 0 rgba(0, 0, 0, 0.12);z-index:50}",append(document.head,t)),init(this,e,Ke,Ge,safe_not_equal,{class:1,style:2,origin:14,dx:12,dy:13,visible:0,duration:15});}}function tn(e){let t="hidden"===document.body.style.overflow;if(e&&t){let e=Math.abs(parseInt(document.body.style.top));document.body.style.cssText=null,document.body.removeAttribute("style"),window.scrollTo(0,e);}else e||t||(document.body.style.top="-"+Math.max(document.body.scrollTop,document.documentElement&&document.documentElement.scrollTop||0)+"px",document.body.style.position="fixed",document.body.style.width="100%",document.body.style.overflow="hidden");}const nn=e=>({}),ln=e=>({}),on=e=>({}),sn=e=>({}),rn=e=>({}),an=e=>({});function cn(t){let n,l,o,i,d,p,v,h,b,D,C,E,Y;const j=t[19].title,T=create_slot(j,t,t[18],an),N=t[19].default,B=create_slot(N,t,t[18],null),I=t[19].actions,S=create_slot(I,t,t[18],sn),q=t[19].footer,_=create_slot(q,t,t[18],ln);let H=[{class:"dialog "+t[1]},{style:`width: ${t[3]}px;${t[2]}`},{tabindex:"-1"},t[6]],O={};for(let e=0;e<H.length;e+=1)O=assign(O,H[e]);return {c(){n=element("div"),l=element("div"),o=element("div"),T&&T.c(),i=space(),d=element("div"),B&&B.c(),p=space(),S&&S.c(),v=space(),_&&_.c(),attr(o,"class","title svelte-1pkw9hl"),attr(d,"class","content svelte-1pkw9hl"),set_attributes(l,O),toggle_class(l,"svelte-1pkw9hl",!0),attr(n,"class","overlay svelte-1pkw9hl");},m(s,a){insert(s,n,a),append(n,l),append(l,o),T&&T.m(o,null),append(l,i),append(l,d),B&&B.m(d,null),append(l,p),S&&S.m(l,null),append(l,v),_&&_.m(l,null),t[21](l),C=!0,E||(Y=[action_destroyer(h=t[8].call(null,l)),listen(l,"mousedown",stop_propagation(t[20])),listen(l,"mouseenter",t[22]),listen(n,"mousedown",t[23]),listen(n,"mouseup",t[24])],E=!0);},p(e,t){T&&T.p&&262144&t&&update_slot(T,j,e,e[18],t,rn,an),B&&B.p&&262144&t&&update_slot(B,N,e,e[18],t,null,null),S&&S.p&&262144&t&&update_slot(S,I,e,e[18],t,on,sn),_&&_.p&&262144&t&&update_slot(_,q,e,e[18],t,nn,ln),set_attributes(l,O=get_spread_update(H,[2&t&&{class:"dialog "+e[1]},12&t&&{style:`width: ${e[3]}px;${e[2]}`},{tabindex:"-1"},64&t&&e[6]])),toggle_class(l,"svelte-1pkw9hl",!0);},i(e){C||(transition_in(T,e),transition_in(B,e),transition_in(S,e),transition_in(_,e),b||add_render_callback(()=>{b=create_in_transition(l,scale,{duration:180,opacity:.5,start:.75,easing:quintOut}),b.start();}),add_render_callback(()=>{D||(D=create_bidirectional_transition(n,fade,{duration:180},!0)),D.run(1);}),C=!0);},o(e){transition_out(T,e),transition_out(B,e),transition_out(S,e),transition_out(_,e),D||(D=create_bidirectional_transition(n,fade,{duration:180},!1)),D.run(0),C=!1;},d(e){e&&detach(n),T&&T.d(e),B&&B.d(e),S&&S.d(e),_&&_.d(e),t[21](null),e&&D&&D.end(),E=!1,run_all(Y);}}}function dn(t){let n,l,o,i,s=t[0]&&cn(t);return {c(){s&&s.c(),n=empty();},m(r,a){s&&s.m(r,a),insert(r,n,a),l=!0,o||(i=[listen(window,"keydown",t[10]),listen(window,"popstate",t[11])],o=!0);},p(e,[t]){e[0]?s?(s.p(e,t),1&t&&transition_in(s,1)):(s=cn(e),s.c(),transition_in(s,1),s.m(n.parentNode,n)):s&&(group_outros(),transition_out(s,1,1,()=>{s=null;}),check_outros());},i(e){l||(transition_in(s),l=!0);},o(e){transition_out(s),l=!1;},d(e){s&&s.d(e),e&&detach(n),o=!1,run_all(i);}}}function un(e,n,l){const o=createEventDispatcher(),i=oe(current_component);let s,{class:r=""}=n,{style:a=""}=n,{visible:c=!1}=n,{width:d=320}=n,{modal:u=!1}=n,{closeByEsc:f=!0}=n,{beforeClose:v=(()=>!0)}=n,h=!1,g={},m=!1;function b(e){v()&&(o("close",e),l(0,c=!1));}async function x(){if(!s)return;await tick();let e=s.querySelectorAll('input:not([type="hidden"])'),t=e.length,n=0;for(;n<t&&!e[n].getAttribute("autofocus");n++);n<t?e[n].focus():t>0?e[0].focus():s.focus(),o("open");}onMount(async()=>{await tick(),l(14,m=!0);}),onDestroy(()=>{m&&tn(!0);});let{$$slots:w={},$$scope:$}=n;return e.$set=e=>{l(17,n=assign(assign({},n),exclude_internal_props(e))),"class"in e&&l(1,r=e.class),"style"in e&&l(2,a=e.style),"visible"in e&&l(0,c=e.visible),"width"in e&&l(3,d=e.width),"modal"in e&&l(4,u=e.modal),"closeByEsc"in e&&l(12,f=e.closeByEsc),"beforeClose"in e&&l(13,v=e.beforeClose),"$$scope"in e&&l(18,$=e.$$scope);},e.$$.update=()=>{{const{style:e,visible:t,width:o,modal:i,closeByEsc:s,beforeClose:r,...a}=n;l(6,g=a);}16385&e.$$.dirty&&(c?(m&&tn(!1),x()):(l(5,h=!1),m&&tn(!0)));},n=exclude_internal_props(n),[c,r,a,d,u,h,g,s,i,b,function(e){const t="Escape";27!==e.keyCode&&e.key!==t&&e.code!==t||f&&b(t),c&&Re(e,s);},function(){l(0,c=!1);},f,v,m,o,x,n,$,w,function(n){bubble(e,n);},function(e){binding_callbacks[e?"unshift":"push"](()=>{l(7,s=e);});},()=>{l(5,h=!1);},()=>{l(5,h=!0);},()=>{h&&!u&&b("clickOutside");}]}class pn extends SvelteComponent{constructor(e){var t;super(),document.getElementById("svelte-1pkw9hl-style")||((t=element("style")).id="svelte-1pkw9hl-style",t.textContent=".overlay.svelte-1pkw9hl{background-color:rgba(0, 0, 0, 0.5);cursor:pointer;position:fixed;left:0;top:0;right:0;bottom:0;z-index:30;display:flex;justify-content:center;align-items:center}.dialog.svelte-1pkw9hl{position:relative;font-size:1rem;background:#eee;background:var(--bg-panel, #eee);border-radius:4px;cursor:auto;box-shadow:0 11px 15px -7px rgba(0, 0, 0, 0.2), 0 24px 38px 3px rgba(0, 0, 0, 0.14),\n\t\t\t0 9px 46px 8px rgba(0, 0, 0, 0.12);z-index:40;max-height:80%;overflow-x:hidden;overflow-y:auto}.dialog.svelte-1pkw9hl:focus{outline:none}.dialog.svelte-1pkw9hl::-moz-focus-inner{border:0}.dialog.svelte-1pkw9hl:-moz-focusring{outline:none}div.svelte-1pkw9hl .actions{min-height:48px;padding:8px;display:flex;align-items:center}div.svelte-1pkw9hl .center{justify-content:center}div.svelte-1pkw9hl .left{justify-content:flex-start}div.svelte-1pkw9hl .right{justify-content:flex-end}.title.svelte-1pkw9hl{padding:16px 16px 12px;font-size:24px;line-height:36px;background:rgba(0, 0, 0, 0.1);background:var(--divider, rgba(0, 0, 0, 0.1))}.content.svelte-1pkw9hl{margin:16px}",append(document.head,t)),init(this,e,un,dn,safe_not_equal,{class:1,style:2,visible:0,width:3,modal:4,closeByEsc:12,beforeClose:13});}}const yn=e=>({}),xn=e=>({});function wn(e){let t,n,l;const o=e[11].default,i=create_slot(o,e,e[14],null);return {c(){t=element("ul"),i&&i.c(),attr(t,"style",n=`min-width: ${e[5]}px`),attr(t,"class","svelte-1vc5q8h");},m(e,n){insert(e,t,n),i&&i.m(t,null),l=!0;},p(e,s){i&&i.p&&16384&s&&update_slot(i,o,e,e[14],s,null,null),(!l||32&s&&n!==(n=`min-width: ${e[5]}px`))&&attr(t,"style",n);},i(e){l||(transition_in(i,e),l=!0);},o(e){transition_out(i,e),l=!1;},d(e){e&&detach(t),i&&i.d(e);}}}function $n(t){let n,l,o,i,d,y,w;const $=t[11].activator,D=create_slot($,t,t[14],xn),C=D||function(e){let t;return {c(){t=element("span");},m(e,n){insert(e,t,n);},d(e){e&&detach(t);}}}();function M(e){t[12].call(null,e);}let E={class:t[0],style:t[1],origin:t[4],dx:t[2],dy:t[3],$$slots:{default:[wn]},$$scope:{ctx:t}};void 0!==t[6]&&(E.visible=t[6]);const Y=new Je({props:E});return binding_callbacks.push(()=>bind(Y,"visible",M)),Y.$on("click",t[10]),{c(){n=element("div"),C&&C.c(),l=space(),create_component(Y.$$.fragment),attr(n,"class","menu svelte-1vc5q8h");},m(o,s){insert(o,n,s),C&&C.m(n,null),append(n,l),mount_component(Y,n,null),t[13](n),d=!0,y||(w=[listen(n,"click",t[9]),action_destroyer(i=t[8].call(null,n))],y=!0);},p(e,[t]){D&&D.p&&16384&t&&update_slot(D,$,e,e[14],t,yn,xn);const n={};1&t&&(n.class=e[0]),2&t&&(n.style=e[1]),16&t&&(n.origin=e[4]),4&t&&(n.dx=e[2]),8&t&&(n.dy=e[3]),16416&t&&(n.$$scope={dirty:t,ctx:e}),!o&&64&t&&(o=!0,n.visible=e[6],add_flush_callback(()=>o=!1)),Y.$set(n);},i(e){d||(transition_in(C,e),transition_in(Y.$$.fragment,e),d=!0);},o(e){transition_out(C,e),transition_out(Y.$$.fragment,e),d=!1;},d(e){e&&detach(n),C&&C.d(e),destroy_component(Y),t[13](null),y=!1,run_all(w);}}}function zn(e,t,n){const l=oe(current_component);let o,{class:i=""}=t,{style:s=null}=t,{dx:r=0}=t,{dy:a=0}=t,{origin:c="top left"}=t,{width:d=112}=t,u=!1;let{$$slots:f={},$$scope:v}=t;return e.$set=e=>{"class"in e&&n(0,i=e.class),"style"in e&&n(1,s=e.style),"dx"in e&&n(2,r=e.dx),"dy"in e&&n(3,a=e.dy),"origin"in e&&n(4,c=e.origin),"width"in e&&n(5,d=e.width),"$$scope"in e&&n(14,v=e.$$scope);},[i,s,r,a,c,d,u,o,l,function(e){try{o.childNodes[0].contains(e.target)?n(6,u=!u):e.target===o&&n(6,u=!1);}catch(e){console.error(e);}},function(e){e.target.classList.contains("menu-item")&&n(6,u=!1);},f,function(e){u=e,n(6,u);},function(e){binding_callbacks[e?"unshift":"push"](()=>{n(7,o=e);});},v]}class kn extends SvelteComponent{constructor(e){var t;super(),document.getElementById("svelte-1vc5q8h-style")||((t=element("style")).id="svelte-1vc5q8h-style",t.textContent="@supports (-webkit-overflow-scrolling: touch){html{cursor:pointer}}.menu.svelte-1vc5q8h{position:relative;display:inline-block;vertical-align:middle}ul.svelte-1vc5q8h{margin:0;padding:8px 0;width:100%;position:relative;overflow-x:hidden;overflow-y:visible}",append(document.head,t)),init(this,e,zn,$n,safe_not_equal,{class:0,style:1,dx:2,dy:3,origin:4,width:5});}}function Dn(t){let n,l,o,i,a,d;const p=t[10].default,v=create_slot(p,t,t[9],null);let h=t[1]&&Mn(),b=[{class:"menu-item "+t[0]},{tabindex:t[2]?"-1":"0"},t[4]],E={};for(let e=0;e<b.length;e+=1)E=assign(E,b[e]);return {c(){n=element("li"),v&&v.c(),l=space(),h&&h.c(),set_attributes(n,E),toggle_class(n,"svelte-mmrniu",!0);},m(s,u){insert(s,n,u),v&&v.m(n,null),append(n,l),h&&h.m(n,null),t[12](n),i=!0,a||(d=[listen(n,"keydown",t[7]),action_destroyer(o=t[6].call(null,n))],a=!0);},p(e,t){v&&v.p&&512&t&&update_slot(v,p,e,e[9],t,null,null),e[1]?h?2&t&&transition_in(h,1):(h=Mn(),h.c(),transition_in(h,1),h.m(n,null)):h&&(group_outros(),transition_out(h,1,1,()=>{h=null;}),check_outros()),set_attributes(n,E=get_spread_update(b,[1&t&&{class:"menu-item "+e[0]},4&t&&{tabindex:e[2]?"-1":"0"},16&t&&e[4]])),toggle_class(n,"svelte-mmrniu",!0);},i(e){i||(transition_in(v,e),transition_in(h),i=!0);},o(e){transition_out(v,e),transition_out(h),i=!1;},d(e){e&&detach(n),v&&v.d(e),h&&h.d(),t[12](null),a=!1,run_all(d);}}}function Cn(t){let n,l,o,i,d,p,v;const h=t[10].default,b=create_slot(h,t,t[9],null);let E=t[1]&&Ln(),Y=[{class:"menu-item "+t[0]},{href:t[3]},{tabindex:t[2]?"-1":"0"},t[4]],j={};for(let e=0;e<Y.length;e+=1)j=assign(j,Y[e]);return {c(){n=element("li"),l=element("a"),b&&b.c(),o=space(),E&&E.c(),set_attributes(l,j),toggle_class(l,"svelte-mmrniu",!0),attr(n,"class","svelte-mmrniu");},m(s,a){insert(s,n,a),append(n,l),b&&b.m(l,null),append(l,o),E&&E.m(l,null),t[11](l),d=!0,p||(v=[listen(l,"keydown",t[7]),action_destroyer(i=t[6].call(null,l))],p=!0);},p(e,t){b&&b.p&&512&t&&update_slot(b,h,e,e[9],t,null,null),e[1]?E?2&t&&transition_in(E,1):(E=Ln(),E.c(),transition_in(E,1),E.m(l,null)):E&&(group_outros(),transition_out(E,1,1,()=>{E=null;}),check_outros()),set_attributes(l,j=get_spread_update(Y,[1&t&&{class:"menu-item "+e[0]},8&t&&{href:e[3]},4&t&&{tabindex:e[2]?"-1":"0"},16&t&&e[4]])),toggle_class(l,"svelte-mmrniu",!0);},i(e){d||(transition_in(b,e),transition_in(E),d=!0);},o(e){transition_out(b,e),transition_out(E),d=!1;},d(e){e&&detach(n),b&&b.d(e),E&&E.d(),t[11](null),p=!1,run_all(v);}}}function Mn(e){let t;const n=new he({});return {c(){create_component(n.$$.fragment);},m(e,l){mount_component(n,e,l),t=!0;},i(e){t||(transition_in(n.$$.fragment,e),t=!0);},o(e){transition_out(n.$$.fragment,e),t=!1;},d(e){destroy_component(n,e);}}}function Ln(e){let t;const n=new he({});return {c(){create_component(n.$$.fragment);},m(e,l){mount_component(n,e,l),t=!0;},i(e){t||(transition_in(n.$$.fragment,e),t=!0);},o(e){transition_out(n.$$.fragment,e),t=!1;},d(e){destroy_component(n,e);}}}function En(e){let t,n,l,o;const i=[Cn,Dn],s=[];function r(e,t){return e[3]?0:1}return t=r(e),n=s[t]=i[t](e),{c(){n.c(),l=empty();},m(e,n){s[t].m(e,n),insert(e,l,n),o=!0;},p(e,[o]){let a=t;t=r(e),t===a?s[t].p(e,o):(group_outros(),transition_out(s[a],1,1,()=>{s[a]=null;}),check_outros(),n=s[t],n||(n=s[t]=i[t](e),n.c()),transition_in(n,1),n.m(l.parentNode,l));},i(e){o||(transition_in(n),o=!0);},o(e){transition_out(n),o=!1;},d(e){s[t].d(e),e&&detach(l);}}}function Yn(e,t,n){const l=oe(current_component);let o,{class:i=""}=t,{ripple:s=!0}=t,r=!1,a=null,c={};let{$$slots:d={},$$scope:u}=t;return e.$set=e=>{n(8,t=assign(assign({},t),exclude_internal_props(e))),"class"in e&&n(0,i=e.class),"ripple"in e&&n(1,s=e.ripple),"$$scope"in e&&n(9,u=e.$$scope);},e.$$.update=()=>{{const{href:e,ripple:l,...o}=t;delete o.class,!1===o.disabled&&delete o.disabled,n(2,r=!!o.disabled),n(3,a=e&&!r?e:null),n(4,c=o);}},t=exclude_internal_props(t),[i,s,r,a,c,o,l,function(e){if(13===e.keyCode||32===e.keyCode){e.stopPropagation(),e.preventDefault();const t=new MouseEvent("click",{bubbles:!0,cancelable:!0});o.dispatchEvent(t),o.blur();}},t,u,d,function(e){binding_callbacks[e?"unshift":"push"](()=>{n(5,o=e);});},function(e){binding_callbacks[e?"unshift":"push"](()=>{n(5,o=e);});}]}class jn extends SvelteComponent{constructor(e){var t;super(),document.getElementById("svelte-mmrniu-style")||((t=element("style")).id="svelte-mmrniu-style",t.textContent="li.svelte-mmrniu{display:block}a.svelte-mmrniu,a.svelte-mmrniu:hover{text-decoration:none}.menu-item.svelte-mmrniu{position:relative;color:inherit;cursor:pointer;height:44px;user-select:none;display:flex;align-items:center;padding:0 16px;white-space:nowrap}.menu-item.svelte-mmrniu:focus{outline:none}.menu-item.svelte-mmrniu::-moz-focus-inner{border:0}.menu-item.svelte-mmrniu:-moz-focusring{outline:none}.menu-item.svelte-mmrniu:before{background-color:currentColor;color:inherit;bottom:0;content:'';left:0;opacity:0;pointer-events:none;position:absolute;right:0;top:0;transition:0.3s cubic-bezier(0.25, 0.8, 0.5, 1)}@media(hover: hover){.menu-item.svelte-mmrniu:hover:not([disabled]):not(.disabled):before{opacity:0.15}.focus-visible.menu-item:focus:not([disabled]):not(.disabled):before{opacity:0.3}}",append(document.head,t)),init(this,e,Yn,En,safe_not_equal,{class:0,ripple:1});}}function An(e){let t;const n=new he({props:{center:!0,circle:!0}});return {c(){create_component(n.$$.fragment);},m(e,l){mount_component(n,e,l),t=!0;},i(e){t||(transition_in(n.$$.fragment,e),t=!0);},o(e){transition_out(n.$$.fragment,e),t=!1;},d(e){destroy_component(n,e);}}}function Tn(t){let n,l,o,i,d,p,y,w,M,E,Y,j,A;const N=new Me({props:{path:t[0]===t[2]?Nn:Bn}});let B=t[7]&&An();const I=t[14].default,F=create_slot(I,t,t[13],null);return {c(){n=element("label"),l=element("input"),i=space(),d=element("div"),create_component(N.$$.fragment),p=space(),B&&B.c(),w=space(),M=element("div"),F&&F.c(),attr(l,"type","radio"),l.disabled=t[5],l.__value=t[2],l.value=l.__value,attr(l,"class","svelte-j29u99"),t[16][0].push(l),attr(d,"class","mark svelte-j29u99"),attr(d,"style",y="color: "+(t[2]===t[0]?t[1]:"#9a9a9a")),attr(M,"class","label-text svelte-j29u99"),attr(n,"class",E=null_to_empty(t[3])+" svelte-j29u99"),attr(n,"style",t[4]),attr(n,"title",t[8]),toggle_class(n,"right",t[6]),toggle_class(n,"disabled",t[5]);},m(s,a){insert(s,n,a),append(n,l),l.checked=l.__value===t[0],t[17](l),append(n,i),append(n,d),mount_component(N,d,null),append(d,p),B&&B.m(d,null),append(n,w),append(n,M),F&&F.m(M,null),Y=!0,j||(A=[listen(l,"change",t[15]),action_destroyer(o=t[10].call(null,l))],j=!0);},p(e,[t]){(!Y||32&t)&&(l.disabled=e[5]),(!Y||4&t)&&(l.__value=e[2]),l.value=l.__value,1&t&&(l.checked=l.__value===e[0]);const o={};5&t&&(o.path=e[0]===e[2]?Nn:Bn),N.$set(o),e[7]?B?128&t&&transition_in(B,1):(B=An(),B.c(),transition_in(B,1),B.m(d,null)):B&&(group_outros(),transition_out(B,1,1,()=>{B=null;}),check_outros()),(!Y||7&t&&y!==(y="color: "+(e[2]===e[0]?e[1]:"#9a9a9a")))&&attr(d,"style",y),F&&F.p&&8192&t&&update_slot(F,I,e,e[13],t,null,null),(!Y||8&t&&E!==(E=null_to_empty(e[3])+" svelte-j29u99"))&&attr(n,"class",E),(!Y||16&t)&&attr(n,"style",e[4]),(!Y||256&t)&&attr(n,"title",e[8]),72&t&&toggle_class(n,"right",e[6]),40&t&&toggle_class(n,"disabled",e[5]);},i(e){Y||(transition_in(N.$$.fragment,e),transition_in(B),transition_in(F,e),Y=!0);},o(e){transition_out(N.$$.fragment,e),transition_out(B),transition_out(F,e),Y=!1;},d(e){e&&detach(n),t[16][0].splice(t[16][0].indexOf(l),1),t[17](null),destroy_component(N),B&&B.d(),F&&F.d(e),j=!1,run_all(A);}}}let Nn="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z",Bn="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z";function In(e,t,n){const l=oe(current_component);let o,{group:i=null}=t,{value:s="on"}=t,{class:r=""}=t,{style:a=null}=t,{color:c="primary"}=t,{disabled:d=!1}=t,{right:u=!1}=t,{ripple:f=!0}=t,{title:v=null}=t,h={};onMount(async()=>{if(await tick(),o)for(let e in h)o.setAttribute(e,h[e]);});let{$$slots:g={},$$scope:m}=t;return e.$set=e=>{n(12,t=assign(assign({},t),exclude_internal_props(e))),"group"in e&&n(0,i=e.group),"value"in e&&n(2,s=e.value),"class"in e&&n(3,r=e.class),"style"in e&&n(4,a=e.style),"color"in e&&n(1,c=e.color),"disabled"in e&&n(5,d=e.disabled),"right"in e&&n(6,u=e.right),"ripple"in e&&n(7,f=e.ripple),"title"in e&&n(8,v=e.title),"$$scope"in e&&n(13,m=e.$$scope);},e.$$.update=()=>{{const{group:e,value:n,style:l,color:o,disabled:i,right:s,ripple:r,title:a,...c}=t;delete c.class,h=c;}2&e.$$.dirty&&("primary"!==c&&c?"accent"===c&&n(1,c=ie()?"#f50057":"var(--accent, #f50057)"):n(1,c=ie()?"#1976d2":"var(--primary, #1976d2)"));},t=exclude_internal_props(t),[i,c,s,r,a,d,u,f,v,o,l,h,t,m,g,function(){i=this.__value,n(0,i);},[[]],function(e){binding_callbacks[e?"unshift":"push"](()=>{n(9,o=e);});}]}class Fn extends SvelteComponent{constructor(e){var t;super(),document.getElementById("svelte-j29u99-style")||((t=element("style")).id="svelte-j29u99-style",t.textContent="label.svelte-j29u99.svelte-j29u99{cursor:pointer;width:100%;align-items:center;display:flex;margin:0;position:relative;line-height:40px;user-select:none}input.svelte-j29u99.svelte-j29u99{cursor:inherit;width:100%;height:100%;position:absolute;top:0;left:0;margin:0;padding:0;opacity:0 !important}.mark.svelte-j29u99.svelte-j29u99{display:flex;position:relative;justify-content:center;align-items:center;border-radius:50%;width:40px;height:40px}.mark.svelte-j29u99.svelte-j29u99:before{background:currentColor;border-radius:inherit;bottom:0;color:inherit;content:'';left:0;opacity:0;pointer-events:none;position:absolute;right:0;top:0;transition:0.3s cubic-bezier(0.25, 0.8, 0.5, 1)}@media not all and (min-resolution: 0.001dpcm){@supports (-webkit-appearance: none) and (stroke-color: transparent){.mark.svelte-j29u99.svelte-j29u99:before{transition:none}}}.label-text.svelte-j29u99.svelte-j29u99{margin-left:4px;white-space:nowrap;overflow:hidden}.right.svelte-j29u99 .label-text.svelte-j29u99{margin-left:0;margin-right:auto;order:-1}@media(hover: hover){label.svelte-j29u99:hover:not([disabled]):not(.disabled) .mark.svelte-j29u99:before{opacity:0.15}.focus-visible:focus:not([disabled]):not(.disabled)~.mark.svelte-j29u99.svelte-j29u99:before{opacity:0.3}}",append(document.head,t)),init(this,e,In,Tn,safe_not_equal,{group:0,value:2,class:3,style:4,color:1,disabled:5,right:6,ripple:7,title:8});}}

    /* src/common/AddButton.svelte generated by Svelte v3.24.1 */

    function create_default_slot(ctx) {
    	let icon;
    	let current;

    	icon = new Me({
    			props: {
    				path: "M 2 10 v 4 h 8 v 8 h 4 v -8 h 8 v -4 h -8 v -8 h -4 v 8z"
    			}
    		});

    	return {
    		c() {
    			create_component(icon.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(icon, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(icon.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(icon.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(icon, detaching);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let button;
    	let current;

    	button = new ye({
    			props: {
    				icon: true,
    				color: "#00796b",
    				raised: true,
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*click_handler*/ ctx[0]);

    	return {
    		c() {
    			create_component(button.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(button, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(button, detaching);
    		}
    	};
    }

    function instance$2($$self) {
    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	return [click_handler];
    }

    class AddButton extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
    	}
    }

    /*
     * Dexie.js - a minimalistic wrapper for IndexedDB
     * ===============================================
     *
     * By David Fahlander, david.fahlander@gmail.com
     *
     * Version 3.0.2, Fri Jul 31 2020
     *
     * http://dexie.org
     *
     * Apache License Version 2.0, January 2004, http://www.apache.org/licenses/
     */
     
    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };










    function __spreadArrays() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    }

    var keys = Object.keys;
    var isArray = Array.isArray;
    var _global = typeof self !== 'undefined' ? self :
        typeof window !== 'undefined' ? window :
            global;
    if (typeof Promise !== 'undefined' && !_global.Promise) {
        _global.Promise = Promise;
    }
    function extend(obj, extension) {
        if (typeof extension !== 'object')
            return obj;
        keys(extension).forEach(function (key) {
            obj[key] = extension[key];
        });
        return obj;
    }
    var getProto = Object.getPrototypeOf;
    var _hasOwn = {}.hasOwnProperty;
    function hasOwn(obj, prop) {
        return _hasOwn.call(obj, prop);
    }
    function props(proto, extension) {
        if (typeof extension === 'function')
            extension = extension(getProto(proto));
        keys(extension).forEach(function (key) {
            setProp(proto, key, extension[key]);
        });
    }
    var defineProperty = Object.defineProperty;
    function setProp(obj, prop, functionOrGetSet, options) {
        defineProperty(obj, prop, extend(functionOrGetSet && hasOwn(functionOrGetSet, "get") && typeof functionOrGetSet.get === 'function' ?
            { get: functionOrGetSet.get, set: functionOrGetSet.set, configurable: true } :
            { value: functionOrGetSet, configurable: true, writable: true }, options));
    }
    function derive(Child) {
        return {
            from: function (Parent) {
                Child.prototype = Object.create(Parent.prototype);
                setProp(Child.prototype, "constructor", Child);
                return {
                    extend: props.bind(null, Child.prototype)
                };
            }
        };
    }
    var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    function getPropertyDescriptor(obj, prop) {
        var pd = getOwnPropertyDescriptor(obj, prop);
        var proto;
        return pd || (proto = getProto(obj)) && getPropertyDescriptor(proto, prop);
    }
    var _slice = [].slice;
    function slice(args, start, end) {
        return _slice.call(args, start, end);
    }
    function override(origFunc, overridedFactory) {
        return overridedFactory(origFunc);
    }
    function assert(b) {
        if (!b)
            throw new Error("Assertion Failed");
    }
    function asap(fn) {
        if (_global.setImmediate)
            setImmediate(fn);
        else
            setTimeout(fn, 0);
    }

    function arrayToObject(array, extractor) {
        return array.reduce(function (result, item, i) {
            var nameAndValue = extractor(item, i);
            if (nameAndValue)
                result[nameAndValue[0]] = nameAndValue[1];
            return result;
        }, {});
    }

    function tryCatch(fn, onerror, args) {
        try {
            fn.apply(null, args);
        }
        catch (ex) {
            onerror && onerror(ex);
        }
    }
    function getByKeyPath(obj, keyPath) {
        if (hasOwn(obj, keyPath))
            return obj[keyPath];
        if (!keyPath)
            return obj;
        if (typeof keyPath !== 'string') {
            var rv = [];
            for (var i = 0, l = keyPath.length; i < l; ++i) {
                var val = getByKeyPath(obj, keyPath[i]);
                rv.push(val);
            }
            return rv;
        }
        var period = keyPath.indexOf('.');
        if (period !== -1) {
            var innerObj = obj[keyPath.substr(0, period)];
            return innerObj === undefined ? undefined : getByKeyPath(innerObj, keyPath.substr(period + 1));
        }
        return undefined;
    }
    function setByKeyPath(obj, keyPath, value) {
        if (!obj || keyPath === undefined)
            return;
        if ('isFrozen' in Object && Object.isFrozen(obj))
            return;
        if (typeof keyPath !== 'string' && 'length' in keyPath) {
            assert(typeof value !== 'string' && 'length' in value);
            for (var i = 0, l = keyPath.length; i < l; ++i) {
                setByKeyPath(obj, keyPath[i], value[i]);
            }
        }
        else {
            var period = keyPath.indexOf('.');
            if (period !== -1) {
                var currentKeyPath = keyPath.substr(0, period);
                var remainingKeyPath = keyPath.substr(period + 1);
                if (remainingKeyPath === "")
                    if (value === undefined) {
                        if (isArray(obj) && !isNaN(parseInt(currentKeyPath)))
                            obj.splice(currentKeyPath, 1);
                        else
                            delete obj[currentKeyPath];
                    }
                    else
                        obj[currentKeyPath] = value;
                else {
                    var innerObj = obj[currentKeyPath];
                    if (!innerObj)
                        innerObj = (obj[currentKeyPath] = {});
                    setByKeyPath(innerObj, remainingKeyPath, value);
                }
            }
            else {
                if (value === undefined) {
                    if (isArray(obj) && !isNaN(parseInt(keyPath)))
                        obj.splice(keyPath, 1);
                    else
                        delete obj[keyPath];
                }
                else
                    obj[keyPath] = value;
            }
        }
    }
    function delByKeyPath(obj, keyPath) {
        if (typeof keyPath === 'string')
            setByKeyPath(obj, keyPath, undefined);
        else if ('length' in keyPath)
            [].map.call(keyPath, function (kp) {
                setByKeyPath(obj, kp, undefined);
            });
    }
    function shallowClone(obj) {
        var rv = {};
        for (var m in obj) {
            if (hasOwn(obj, m))
                rv[m] = obj[m];
        }
        return rv;
    }
    var concat = [].concat;
    function flatten(a) {
        return concat.apply([], a);
    }
    var intrinsicTypeNames = "Boolean,String,Date,RegExp,Blob,File,FileList,ArrayBuffer,DataView,Uint8ClampedArray,ImageData,Map,Set"
        .split(',').concat(flatten([8, 16, 32, 64].map(function (num) { return ["Int", "Uint", "Float"].map(function (t) { return t + num + "Array"; }); }))).filter(function (t) { return _global[t]; });
    var intrinsicTypes = intrinsicTypeNames.map(function (t) { return _global[t]; });
    var intrinsicTypeNameSet = arrayToObject(intrinsicTypeNames, function (x) { return [x, true]; });
    function deepClone(any) {
        if (!any || typeof any !== 'object')
            return any;
        var rv;
        if (isArray(any)) {
            rv = [];
            for (var i = 0, l = any.length; i < l; ++i) {
                rv.push(deepClone(any[i]));
            }
        }
        else if (intrinsicTypes.indexOf(any.constructor) >= 0) {
            rv = any;
        }
        else {
            rv = any.constructor ? Object.create(any.constructor.prototype) : {};
            for (var prop in any) {
                if (hasOwn(any, prop)) {
                    rv[prop] = deepClone(any[prop]);
                }
            }
        }
        return rv;
    }
    var toString = {}.toString;
    function toStringTag(o) {
        return toString.call(o).slice(8, -1);
    }
    var getValueOf = function (val, type) {
        return type === "Array" ? '' + val.map(function (v) { return getValueOf(v, toStringTag(v)); }) :
            type === "ArrayBuffer" ? '' + new Uint8Array(val) :
                type === "Date" ? val.getTime() :
                    ArrayBuffer.isView(val) ? '' + new Uint8Array(val.buffer) :
                        val;
    };
    function getObjectDiff(a, b, rv, prfx) {
        rv = rv || {};
        prfx = prfx || '';
        keys(a).forEach(function (prop) {
            if (!hasOwn(b, prop))
                rv[prfx + prop] = undefined;
            else {
                var ap = a[prop], bp = b[prop];
                if (typeof ap === 'object' && typeof bp === 'object' && ap && bp) {
                    var apTypeName = toStringTag(ap);
                    var bpTypeName = toStringTag(bp);
                    if (apTypeName === bpTypeName) {
                        if (intrinsicTypeNameSet[apTypeName]) {
                            if (getValueOf(ap, apTypeName) !== getValueOf(bp, bpTypeName)) {
                                rv[prfx + prop] = b[prop];
                            }
                        }
                        else {
                            getObjectDiff(ap, bp, rv, prfx + prop + ".");
                        }
                    }
                    else {
                        rv[prfx + prop] = b[prop];
                    }
                }
                else if (ap !== bp)
                    rv[prfx + prop] = b[prop];
            }
        });
        keys(b).forEach(function (prop) {
            if (!hasOwn(a, prop)) {
                rv[prfx + prop] = b[prop];
            }
        });
        return rv;
    }
    var iteratorSymbol = typeof Symbol !== 'undefined' && Symbol.iterator;
    var getIteratorOf = iteratorSymbol ? function (x) {
        var i;
        return x != null && (i = x[iteratorSymbol]) && i.apply(x);
    } : function () { return null; };
    var NO_CHAR_ARRAY = {};
    function getArrayOf(arrayLike) {
        var i, a, x, it;
        if (arguments.length === 1) {
            if (isArray(arrayLike))
                return arrayLike.slice();
            if (this === NO_CHAR_ARRAY && typeof arrayLike === 'string')
                return [arrayLike];
            if ((it = getIteratorOf(arrayLike))) {
                a = [];
                while (x = it.next(), !x.done)
                    a.push(x.value);
                return a;
            }
            if (arrayLike == null)
                return [arrayLike];
            i = arrayLike.length;
            if (typeof i === 'number') {
                a = new Array(i);
                while (i--)
                    a[i] = arrayLike[i];
                return a;
            }
            return [arrayLike];
        }
        i = arguments.length;
        a = new Array(i);
        while (i--)
            a[i] = arguments[i];
        return a;
    }
    var isAsyncFunction = typeof Symbol !== 'undefined'
        ? function (fn) { return fn[Symbol.toStringTag] === 'AsyncFunction'; }
        : function () { return false; };

    var debug = typeof location !== 'undefined' &&
        /^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href);
    function setDebug(value, filter) {
        debug = value;
        libraryFilter = filter;
    }
    var libraryFilter = function () { return true; };
    var NEEDS_THROW_FOR_STACK = !new Error("").stack;
    function getErrorWithStack() {
        if (NEEDS_THROW_FOR_STACK)
            try {
                throw new Error();
            }
            catch (e) {
                return e;
            }
        return new Error();
    }
    function prettyStack(exception, numIgnoredFrames) {
        var stack = exception.stack;
        if (!stack)
            return "";
        numIgnoredFrames = (numIgnoredFrames || 0);
        if (stack.indexOf(exception.name) === 0)
            numIgnoredFrames += (exception.name + exception.message).split('\n').length;
        return stack.split('\n')
            .slice(numIgnoredFrames)
            .filter(libraryFilter)
            .map(function (frame) { return "\n" + frame; })
            .join('');
    }

    var dexieErrorNames = [
        'Modify',
        'Bulk',
        'OpenFailed',
        'VersionChange',
        'Schema',
        'Upgrade',
        'InvalidTable',
        'MissingAPI',
        'NoSuchDatabase',
        'InvalidArgument',
        'SubTransaction',
        'Unsupported',
        'Internal',
        'DatabaseClosed',
        'PrematureCommit',
        'ForeignAwait'
    ];
    var idbDomErrorNames = [
        'Unknown',
        'Constraint',
        'Data',
        'TransactionInactive',
        'ReadOnly',
        'Version',
        'NotFound',
        'InvalidState',
        'InvalidAccess',
        'Abort',
        'Timeout',
        'QuotaExceeded',
        'Syntax',
        'DataClone'
    ];
    var errorList = dexieErrorNames.concat(idbDomErrorNames);
    var defaultTexts = {
        VersionChanged: "Database version changed by other database connection",
        DatabaseClosed: "Database has been closed",
        Abort: "Transaction aborted",
        TransactionInactive: "Transaction has already completed or failed"
    };
    function DexieError(name, msg) {
        this._e = getErrorWithStack();
        this.name = name;
        this.message = msg;
    }
    derive(DexieError).from(Error).extend({
        stack: {
            get: function () {
                return this._stack ||
                    (this._stack = this.name + ": " + this.message + prettyStack(this._e, 2));
            }
        },
        toString: function () { return this.name + ": " + this.message; }
    });
    function getMultiErrorMessage(msg, failures) {
        return msg + ". Errors: " + Object.keys(failures)
            .map(function (key) { return failures[key].toString(); })
            .filter(function (v, i, s) { return s.indexOf(v) === i; })
            .join('\n');
    }
    function ModifyError(msg, failures, successCount, failedKeys) {
        this._e = getErrorWithStack();
        this.failures = failures;
        this.failedKeys = failedKeys;
        this.successCount = successCount;
        this.message = getMultiErrorMessage(msg, failures);
    }
    derive(ModifyError).from(DexieError);
    function BulkError(msg, failures) {
        this._e = getErrorWithStack();
        this.name = "BulkError";
        this.failures = failures;
        this.message = getMultiErrorMessage(msg, failures);
    }
    derive(BulkError).from(DexieError);
    var errnames = errorList.reduce(function (obj, name) { return (obj[name] = name + "Error", obj); }, {});
    var BaseException = DexieError;
    var exceptions = errorList.reduce(function (obj, name) {
        var fullName = name + "Error";
        function DexieError(msgOrInner, inner) {
            this._e = getErrorWithStack();
            this.name = fullName;
            if (!msgOrInner) {
                this.message = defaultTexts[name] || fullName;
                this.inner = null;
            }
            else if (typeof msgOrInner === 'string') {
                this.message = "" + msgOrInner + (!inner ? '' : '\n ' + inner);
                this.inner = inner || null;
            }
            else if (typeof msgOrInner === 'object') {
                this.message = msgOrInner.name + " " + msgOrInner.message;
                this.inner = msgOrInner;
            }
        }
        derive(DexieError).from(BaseException);
        obj[name] = DexieError;
        return obj;
    }, {});
    exceptions.Syntax = SyntaxError;
    exceptions.Type = TypeError;
    exceptions.Range = RangeError;
    var exceptionMap = idbDomErrorNames.reduce(function (obj, name) {
        obj[name + "Error"] = exceptions[name];
        return obj;
    }, {});
    function mapError(domError, message) {
        if (!domError || domError instanceof DexieError || domError instanceof TypeError || domError instanceof SyntaxError || !domError.name || !exceptionMap[domError.name])
            return domError;
        var rv = new exceptionMap[domError.name](message || domError.message, domError);
        if ("stack" in domError) {
            setProp(rv, "stack", { get: function () {
                    return this.inner.stack;
                } });
        }
        return rv;
    }
    var fullNameExceptions = errorList.reduce(function (obj, name) {
        if (["Syntax", "Type", "Range"].indexOf(name) === -1)
            obj[name + "Error"] = exceptions[name];
        return obj;
    }, {});
    fullNameExceptions.ModifyError = ModifyError;
    fullNameExceptions.DexieError = DexieError;
    fullNameExceptions.BulkError = BulkError;

    function nop() { }
    function mirror(val) { return val; }
    function pureFunctionChain(f1, f2) {
        if (f1 == null || f1 === mirror)
            return f2;
        return function (val) {
            return f2(f1(val));
        };
    }
    function callBoth(on1, on2) {
        return function () {
            on1.apply(this, arguments);
            on2.apply(this, arguments);
        };
    }
    function hookCreatingChain(f1, f2) {
        if (f1 === nop)
            return f2;
        return function () {
            var res = f1.apply(this, arguments);
            if (res !== undefined)
                arguments[0] = res;
            var onsuccess = this.onsuccess,
            onerror = this.onerror;
            this.onsuccess = null;
            this.onerror = null;
            var res2 = f2.apply(this, arguments);
            if (onsuccess)
                this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
            if (onerror)
                this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
            return res2 !== undefined ? res2 : res;
        };
    }
    function hookDeletingChain(f1, f2) {
        if (f1 === nop)
            return f2;
        return function () {
            f1.apply(this, arguments);
            var onsuccess = this.onsuccess,
            onerror = this.onerror;
            this.onsuccess = this.onerror = null;
            f2.apply(this, arguments);
            if (onsuccess)
                this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
            if (onerror)
                this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
        };
    }
    function hookUpdatingChain(f1, f2) {
        if (f1 === nop)
            return f2;
        return function (modifications) {
            var res = f1.apply(this, arguments);
            extend(modifications, res);
            var onsuccess = this.onsuccess,
            onerror = this.onerror;
            this.onsuccess = null;
            this.onerror = null;
            var res2 = f2.apply(this, arguments);
            if (onsuccess)
                this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
            if (onerror)
                this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
            return res === undefined ?
                (res2 === undefined ? undefined : res2) :
                (extend(res, res2));
        };
    }
    function reverseStoppableEventChain(f1, f2) {
        if (f1 === nop)
            return f2;
        return function () {
            if (f2.apply(this, arguments) === false)
                return false;
            return f1.apply(this, arguments);
        };
    }

    function promisableChain(f1, f2) {
        if (f1 === nop)
            return f2;
        return function () {
            var res = f1.apply(this, arguments);
            if (res && typeof res.then === 'function') {
                var thiz = this, i = arguments.length, args = new Array(i);
                while (i--)
                    args[i] = arguments[i];
                return res.then(function () {
                    return f2.apply(thiz, args);
                });
            }
            return f2.apply(this, arguments);
        };
    }

    var INTERNAL = {};
    var LONG_STACKS_CLIP_LIMIT = 100;
    var MAX_LONG_STACKS = 20;
    var ZONE_ECHO_LIMIT = 100;
    var _a = typeof Promise === 'undefined' ?
        [] :
        (function () {
            var globalP = Promise.resolve();
            if (typeof crypto === 'undefined' || !crypto.subtle)
                return [globalP, globalP.__proto__, globalP];
            var nativeP = crypto.subtle.digest("SHA-512", new Uint8Array([0]));
            return [
                nativeP,
                nativeP.__proto__,
                globalP
            ];
        })();
    var resolvedNativePromise = _a[0];
    var nativePromiseProto = _a[1];
    var resolvedGlobalPromise = _a[2];
    var nativePromiseThen = nativePromiseProto && nativePromiseProto.then;
    var NativePromise = resolvedNativePromise && resolvedNativePromise.constructor;
    var patchGlobalPromise = !!resolvedGlobalPromise;
    var stack_being_generated = false;
    var schedulePhysicalTick = resolvedGlobalPromise ?
        function () { resolvedGlobalPromise.then(physicalTick); }
        :
            _global.setImmediate ?
                setImmediate.bind(null, physicalTick) :
                _global.MutationObserver ?
                    function () {
                        var hiddenDiv = document.createElement("div");
                        (new MutationObserver(function () {
                            physicalTick();
                            hiddenDiv = null;
                        })).observe(hiddenDiv, { attributes: true });
                        hiddenDiv.setAttribute('i', '1');
                    } :
                    function () { setTimeout(physicalTick, 0); };
    var asap$1 = function (callback, args) {
        microtickQueue.push([callback, args]);
        if (needsNewPhysicalTick) {
            schedulePhysicalTick();
            needsNewPhysicalTick = false;
        }
    };
    var isOutsideMicroTick = true;
    var needsNewPhysicalTick = true;
    var unhandledErrors = [];
    var rejectingErrors = [];
    var currentFulfiller = null;
    var rejectionMapper = mirror;
    var globalPSD = {
        id: 'global',
        global: true,
        ref: 0,
        unhandleds: [],
        onunhandled: globalError,
        pgp: false,
        env: {},
        finalize: function () {
            this.unhandleds.forEach(function (uh) {
                try {
                    globalError(uh[0], uh[1]);
                }
                catch (e) { }
            });
        }
    };
    var PSD = globalPSD;
    var microtickQueue = [];
    var numScheduledCalls = 0;
    var tickFinalizers = [];
    function DexiePromise(fn) {
        if (typeof this !== 'object')
            throw new TypeError('Promises must be constructed via new');
        this._listeners = [];
        this.onuncatched = nop;
        this._lib = false;
        var psd = (this._PSD = PSD);
        if (debug) {
            this._stackHolder = getErrorWithStack();
            this._prev = null;
            this._numPrev = 0;
        }
        if (typeof fn !== 'function') {
            if (fn !== INTERNAL)
                throw new TypeError('Not a function');
            this._state = arguments[1];
            this._value = arguments[2];
            if (this._state === false)
                handleRejection(this, this._value);
            return;
        }
        this._state = null;
        this._value = null;
        ++psd.ref;
        executePromiseTask(this, fn);
    }
    var thenProp = {
        get: function () {
            var psd = PSD, microTaskId = totalEchoes;
            function then(onFulfilled, onRejected) {
                var _this = this;
                var possibleAwait = !psd.global && (psd !== PSD || microTaskId !== totalEchoes);
                if (possibleAwait)
                    decrementExpectedAwaits();
                var rv = new DexiePromise(function (resolve, reject) {
                    propagateToListener(_this, new Listener(nativeAwaitCompatibleWrap(onFulfilled, psd, possibleAwait), nativeAwaitCompatibleWrap(onRejected, psd, possibleAwait), resolve, reject, psd));
                });
                debug && linkToPreviousPromise(rv, this);
                return rv;
            }
            then.prototype = INTERNAL;
            return then;
        },
        set: function (value) {
            setProp(this, 'then', value && value.prototype === INTERNAL ?
                thenProp :
                {
                    get: function () {
                        return value;
                    },
                    set: thenProp.set
                });
        }
    };
    props(DexiePromise.prototype, {
        then: thenProp,
        _then: function (onFulfilled, onRejected) {
            propagateToListener(this, new Listener(null, null, onFulfilled, onRejected, PSD));
        },
        catch: function (onRejected) {
            if (arguments.length === 1)
                return this.then(null, onRejected);
            var type = arguments[0], handler = arguments[1];
            return typeof type === 'function' ? this.then(null, function (err) {
                return err instanceof type ? handler(err) : PromiseReject(err);
            })
                : this.then(null, function (err) {
                    return err && err.name === type ? handler(err) : PromiseReject(err);
                });
        },
        finally: function (onFinally) {
            return this.then(function (value) {
                onFinally();
                return value;
            }, function (err) {
                onFinally();
                return PromiseReject(err);
            });
        },
        stack: {
            get: function () {
                if (this._stack)
                    return this._stack;
                try {
                    stack_being_generated = true;
                    var stacks = getStack(this, [], MAX_LONG_STACKS);
                    var stack = stacks.join("\nFrom previous: ");
                    if (this._state !== null)
                        this._stack = stack;
                    return stack;
                }
                finally {
                    stack_being_generated = false;
                }
            }
        },
        timeout: function (ms, msg) {
            var _this = this;
            return ms < Infinity ?
                new DexiePromise(function (resolve, reject) {
                    var handle = setTimeout(function () { return reject(new exceptions.Timeout(msg)); }, ms);
                    _this.then(resolve, reject).finally(clearTimeout.bind(null, handle));
                }) : this;
        }
    });
    if (typeof Symbol !== 'undefined' && Symbol.toStringTag)
        setProp(DexiePromise.prototype, Symbol.toStringTag, 'Dexie.Promise');
    globalPSD.env = snapShot();
    function Listener(onFulfilled, onRejected, resolve, reject, zone) {
        this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
        this.onRejected = typeof onRejected === 'function' ? onRejected : null;
        this.resolve = resolve;
        this.reject = reject;
        this.psd = zone;
    }
    props(DexiePromise, {
        all: function () {
            var values = getArrayOf.apply(null, arguments)
                .map(onPossibleParallellAsync);
            return new DexiePromise(function (resolve, reject) {
                if (values.length === 0)
                    resolve([]);
                var remaining = values.length;
                values.forEach(function (a, i) { return DexiePromise.resolve(a).then(function (x) {
                    values[i] = x;
                    if (!--remaining)
                        resolve(values);
                }, reject); });
            });
        },
        resolve: function (value) {
            if (value instanceof DexiePromise)
                return value;
            if (value && typeof value.then === 'function')
                return new DexiePromise(function (resolve, reject) {
                    value.then(resolve, reject);
                });
            var rv = new DexiePromise(INTERNAL, true, value);
            linkToPreviousPromise(rv, currentFulfiller);
            return rv;
        },
        reject: PromiseReject,
        race: function () {
            var values = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
            return new DexiePromise(function (resolve, reject) {
                values.map(function (value) { return DexiePromise.resolve(value).then(resolve, reject); });
            });
        },
        PSD: {
            get: function () { return PSD; },
            set: function (value) { return PSD = value; }
        },
        newPSD: newScope,
        usePSD: usePSD,
        scheduler: {
            get: function () { return asap$1; },
            set: function (value) { asap$1 = value; }
        },
        rejectionMapper: {
            get: function () { return rejectionMapper; },
            set: function (value) { rejectionMapper = value; }
        },
        follow: function (fn, zoneProps) {
            return new DexiePromise(function (resolve, reject) {
                return newScope(function (resolve, reject) {
                    var psd = PSD;
                    psd.unhandleds = [];
                    psd.onunhandled = reject;
                    psd.finalize = callBoth(function () {
                        var _this = this;
                        run_at_end_of_this_or_next_physical_tick(function () {
                            _this.unhandleds.length === 0 ? resolve() : reject(_this.unhandleds[0]);
                        });
                    }, psd.finalize);
                    fn();
                }, zoneProps, resolve, reject);
            });
        }
    });
    if (NativePromise) {
        if (NativePromise.allSettled)
            setProp(DexiePromise, "allSettled", function () {
                var possiblePromises = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
                return new DexiePromise(function (resolve) {
                    if (possiblePromises.length === 0)
                        resolve([]);
                    var remaining = possiblePromises.length;
                    var results = new Array(remaining);
                    possiblePromises.forEach(function (p, i) { return DexiePromise.resolve(p).then(function (value) { return results[i] = { status: "fulfilled", value: value }; }, function (reason) { return results[i] = { status: "rejected", reason: reason }; })
                        .then(function () { return --remaining || resolve(results); }); });
                });
            });
        if (NativePromise.any && typeof AggregateError !== 'undefined')
            setProp(DexiePromise, "any", function () {
                var possiblePromises = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
                return new DexiePromise(function (resolve, reject) {
                    if (possiblePromises.length === 0)
                        reject(new AggregateError([]));
                    var remaining = possiblePromises.length;
                    var failures = new Array(remaining);
                    possiblePromises.forEach(function (p, i) { return DexiePromise.resolve(p).then(function (value) { return resolve(value); }, function (failure) {
                        failures[i] = failure;
                        if (!--remaining)
                            reject(new AggregateError(failures));
                    }); });
                });
            });
    }
    function executePromiseTask(promise, fn) {
        try {
            fn(function (value) {
                if (promise._state !== null)
                    return;
                if (value === promise)
                    throw new TypeError('A promise cannot be resolved with itself.');
                var shouldExecuteTick = promise._lib && beginMicroTickScope();
                if (value && typeof value.then === 'function') {
                    executePromiseTask(promise, function (resolve, reject) {
                        value instanceof DexiePromise ?
                            value._then(resolve, reject) :
                            value.then(resolve, reject);
                    });
                }
                else {
                    promise._state = true;
                    promise._value = value;
                    propagateAllListeners(promise);
                }
                if (shouldExecuteTick)
                    endMicroTickScope();
            }, handleRejection.bind(null, promise));
        }
        catch (ex) {
            handleRejection(promise, ex);
        }
    }
    function handleRejection(promise, reason) {
        rejectingErrors.push(reason);
        if (promise._state !== null)
            return;
        var shouldExecuteTick = promise._lib && beginMicroTickScope();
        reason = rejectionMapper(reason);
        promise._state = false;
        promise._value = reason;
        debug && reason !== null && typeof reason === 'object' && !reason._promise && tryCatch(function () {
            var origProp = getPropertyDescriptor(reason, "stack");
            reason._promise = promise;
            setProp(reason, "stack", {
                get: function () {
                    return stack_being_generated ?
                        origProp && (origProp.get ?
                            origProp.get.apply(reason) :
                            origProp.value) :
                        promise.stack;
                }
            });
        });
        addPossiblyUnhandledError(promise);
        propagateAllListeners(promise);
        if (shouldExecuteTick)
            endMicroTickScope();
    }
    function propagateAllListeners(promise) {
        var listeners = promise._listeners;
        promise._listeners = [];
        for (var i = 0, len = listeners.length; i < len; ++i) {
            propagateToListener(promise, listeners[i]);
        }
        var psd = promise._PSD;
        --psd.ref || psd.finalize();
        if (numScheduledCalls === 0) {
            ++numScheduledCalls;
            asap$1(function () {
                if (--numScheduledCalls === 0)
                    finalizePhysicalTick();
            }, []);
        }
    }
    function propagateToListener(promise, listener) {
        if (promise._state === null) {
            promise._listeners.push(listener);
            return;
        }
        var cb = promise._state ? listener.onFulfilled : listener.onRejected;
        if (cb === null) {
            return (promise._state ? listener.resolve : listener.reject)(promise._value);
        }
        ++listener.psd.ref;
        ++numScheduledCalls;
        asap$1(callListener, [cb, promise, listener]);
    }
    function callListener(cb, promise, listener) {
        try {
            currentFulfiller = promise;
            var ret, value = promise._value;
            if (promise._state) {
                ret = cb(value);
            }
            else {
                if (rejectingErrors.length)
                    rejectingErrors = [];
                ret = cb(value);
                if (rejectingErrors.indexOf(value) === -1)
                    markErrorAsHandled(promise);
            }
            listener.resolve(ret);
        }
        catch (e) {
            listener.reject(e);
        }
        finally {
            currentFulfiller = null;
            if (--numScheduledCalls === 0)
                finalizePhysicalTick();
            --listener.psd.ref || listener.psd.finalize();
        }
    }
    function getStack(promise, stacks, limit) {
        if (stacks.length === limit)
            return stacks;
        var stack = "";
        if (promise._state === false) {
            var failure = promise._value, errorName, message;
            if (failure != null) {
                errorName = failure.name || "Error";
                message = failure.message || failure;
                stack = prettyStack(failure, 0);
            }
            else {
                errorName = failure;
                message = "";
            }
            stacks.push(errorName + (message ? ": " + message : "") + stack);
        }
        if (debug) {
            stack = prettyStack(promise._stackHolder, 2);
            if (stack && stacks.indexOf(stack) === -1)
                stacks.push(stack);
            if (promise._prev)
                getStack(promise._prev, stacks, limit);
        }
        return stacks;
    }
    function linkToPreviousPromise(promise, prev) {
        var numPrev = prev ? prev._numPrev + 1 : 0;
        if (numPrev < LONG_STACKS_CLIP_LIMIT) {
            promise._prev = prev;
            promise._numPrev = numPrev;
        }
    }
    function physicalTick() {
        beginMicroTickScope() && endMicroTickScope();
    }
    function beginMicroTickScope() {
        var wasRootExec = isOutsideMicroTick;
        isOutsideMicroTick = false;
        needsNewPhysicalTick = false;
        return wasRootExec;
    }
    function endMicroTickScope() {
        var callbacks, i, l;
        do {
            while (microtickQueue.length > 0) {
                callbacks = microtickQueue;
                microtickQueue = [];
                l = callbacks.length;
                for (i = 0; i < l; ++i) {
                    var item = callbacks[i];
                    item[0].apply(null, item[1]);
                }
            }
        } while (microtickQueue.length > 0);
        isOutsideMicroTick = true;
        needsNewPhysicalTick = true;
    }
    function finalizePhysicalTick() {
        var unhandledErrs = unhandledErrors;
        unhandledErrors = [];
        unhandledErrs.forEach(function (p) {
            p._PSD.onunhandled.call(null, p._value, p);
        });
        var finalizers = tickFinalizers.slice(0);
        var i = finalizers.length;
        while (i)
            finalizers[--i]();
    }
    function run_at_end_of_this_or_next_physical_tick(fn) {
        function finalizer() {
            fn();
            tickFinalizers.splice(tickFinalizers.indexOf(finalizer), 1);
        }
        tickFinalizers.push(finalizer);
        ++numScheduledCalls;
        asap$1(function () {
            if (--numScheduledCalls === 0)
                finalizePhysicalTick();
        }, []);
    }
    function addPossiblyUnhandledError(promise) {
        if (!unhandledErrors.some(function (p) { return p._value === promise._value; }))
            unhandledErrors.push(promise);
    }
    function markErrorAsHandled(promise) {
        var i = unhandledErrors.length;
        while (i)
            if (unhandledErrors[--i]._value === promise._value) {
                unhandledErrors.splice(i, 1);
                return;
            }
    }
    function PromiseReject(reason) {
        return new DexiePromise(INTERNAL, false, reason);
    }
    function wrap(fn, errorCatcher) {
        var psd = PSD;
        return function () {
            var wasRootExec = beginMicroTickScope(), outerScope = PSD;
            try {
                switchToZone(psd, true);
                return fn.apply(this, arguments);
            }
            catch (e) {
                errorCatcher && errorCatcher(e);
            }
            finally {
                switchToZone(outerScope, false);
                if (wasRootExec)
                    endMicroTickScope();
            }
        };
    }
    var task = { awaits: 0, echoes: 0, id: 0 };
    var taskCounter = 0;
    var zoneStack = [];
    var zoneEchoes = 0;
    var totalEchoes = 0;
    var zone_id_counter = 0;
    function newScope(fn, props$$1, a1, a2) {
        var parent = PSD, psd = Object.create(parent);
        psd.parent = parent;
        psd.ref = 0;
        psd.global = false;
        psd.id = ++zone_id_counter;
        var globalEnv = globalPSD.env;
        psd.env = patchGlobalPromise ? {
            Promise: DexiePromise,
            PromiseProp: { value: DexiePromise, configurable: true, writable: true },
            all: DexiePromise.all,
            race: DexiePromise.race,
            allSettled: DexiePromise.allSettled,
            any: DexiePromise.any,
            resolve: DexiePromise.resolve,
            reject: DexiePromise.reject,
            nthen: getPatchedPromiseThen(globalEnv.nthen, psd),
            gthen: getPatchedPromiseThen(globalEnv.gthen, psd)
        } : {};
        if (props$$1)
            extend(psd, props$$1);
        ++parent.ref;
        psd.finalize = function () {
            --this.parent.ref || this.parent.finalize();
        };
        var rv = usePSD(psd, fn, a1, a2);
        if (psd.ref === 0)
            psd.finalize();
        return rv;
    }
    function incrementExpectedAwaits() {
        if (!task.id)
            task.id = ++taskCounter;
        ++task.awaits;
        task.echoes += ZONE_ECHO_LIMIT;
        return task.id;
    }
    function decrementExpectedAwaits(sourceTaskId) {
        if (!task.awaits || (sourceTaskId && sourceTaskId !== task.id))
            return;
        if (--task.awaits === 0)
            task.id = 0;
        task.echoes = task.awaits * ZONE_ECHO_LIMIT;
    }
    if (('' + nativePromiseThen).indexOf('[native code]') === -1) {
        incrementExpectedAwaits = decrementExpectedAwaits = nop;
    }
    function onPossibleParallellAsync(possiblePromise) {
        if (task.echoes && possiblePromise && possiblePromise.constructor === NativePromise) {
            incrementExpectedAwaits();
            return possiblePromise.then(function (x) {
                decrementExpectedAwaits();
                return x;
            }, function (e) {
                decrementExpectedAwaits();
                return rejection(e);
            });
        }
        return possiblePromise;
    }
    function zoneEnterEcho(targetZone) {
        ++totalEchoes;
        if (!task.echoes || --task.echoes === 0) {
            task.echoes = task.id = 0;
        }
        zoneStack.push(PSD);
        switchToZone(targetZone, true);
    }
    function zoneLeaveEcho() {
        var zone = zoneStack[zoneStack.length - 1];
        zoneStack.pop();
        switchToZone(zone, false);
    }
    function switchToZone(targetZone, bEnteringZone) {
        var currentZone = PSD;
        if (bEnteringZone ? task.echoes && (!zoneEchoes++ || targetZone !== PSD) : zoneEchoes && (!--zoneEchoes || targetZone !== PSD)) {
            enqueueNativeMicroTask(bEnteringZone ? zoneEnterEcho.bind(null, targetZone) : zoneLeaveEcho);
        }
        if (targetZone === PSD)
            return;
        PSD = targetZone;
        if (currentZone === globalPSD)
            globalPSD.env = snapShot();
        if (patchGlobalPromise) {
            var GlobalPromise_1 = globalPSD.env.Promise;
            var targetEnv = targetZone.env;
            nativePromiseProto.then = targetEnv.nthen;
            GlobalPromise_1.prototype.then = targetEnv.gthen;
            if (currentZone.global || targetZone.global) {
                Object.defineProperty(_global, 'Promise', targetEnv.PromiseProp);
                GlobalPromise_1.all = targetEnv.all;
                GlobalPromise_1.race = targetEnv.race;
                GlobalPromise_1.resolve = targetEnv.resolve;
                GlobalPromise_1.reject = targetEnv.reject;
                if (targetEnv.allSettled)
                    GlobalPromise_1.allSettled = targetEnv.allSettled;
                if (targetEnv.any)
                    GlobalPromise_1.any = targetEnv.any;
            }
        }
    }
    function snapShot() {
        var GlobalPromise = _global.Promise;
        return patchGlobalPromise ? {
            Promise: GlobalPromise,
            PromiseProp: Object.getOwnPropertyDescriptor(_global, "Promise"),
            all: GlobalPromise.all,
            race: GlobalPromise.race,
            allSettled: GlobalPromise.allSettled,
            any: GlobalPromise.any,
            resolve: GlobalPromise.resolve,
            reject: GlobalPromise.reject,
            nthen: nativePromiseProto.then,
            gthen: GlobalPromise.prototype.then
        } : {};
    }
    function usePSD(psd, fn, a1, a2, a3) {
        var outerScope = PSD;
        try {
            switchToZone(psd, true);
            return fn(a1, a2, a3);
        }
        finally {
            switchToZone(outerScope, false);
        }
    }
    function enqueueNativeMicroTask(job) {
        nativePromiseThen.call(resolvedNativePromise, job);
    }
    function nativeAwaitCompatibleWrap(fn, zone, possibleAwait) {
        return typeof fn !== 'function' ? fn : function () {
            var outerZone = PSD;
            if (possibleAwait)
                incrementExpectedAwaits();
            switchToZone(zone, true);
            try {
                return fn.apply(this, arguments);
            }
            finally {
                switchToZone(outerZone, false);
            }
        };
    }
    function getPatchedPromiseThen(origThen, zone) {
        return function (onResolved, onRejected) {
            return origThen.call(this, nativeAwaitCompatibleWrap(onResolved, zone, false), nativeAwaitCompatibleWrap(onRejected, zone, false));
        };
    }
    var UNHANDLEDREJECTION = "unhandledrejection";
    function globalError(err, promise) {
        var rv;
        try {
            rv = promise.onuncatched(err);
        }
        catch (e) { }
        if (rv !== false)
            try {
                var event, eventData = { promise: promise, reason: err };
                if (_global.document && document.createEvent) {
                    event = document.createEvent('Event');
                    event.initEvent(UNHANDLEDREJECTION, true, true);
                    extend(event, eventData);
                }
                else if (_global.CustomEvent) {
                    event = new CustomEvent(UNHANDLEDREJECTION, { detail: eventData });
                    extend(event, eventData);
                }
                if (event && _global.dispatchEvent) {
                    dispatchEvent(event);
                    if (!_global.PromiseRejectionEvent && _global.onunhandledrejection)
                        try {
                            _global.onunhandledrejection(event);
                        }
                        catch (_) { }
                }
                if (debug && event && !event.defaultPrevented) {
                    console.warn("Unhandled rejection: " + (err.stack || err));
                }
            }
            catch (e) { }
    }
    var rejection = DexiePromise.reject;

    function tempTransaction(db, mode, storeNames, fn) {
        if (!db._state.openComplete && (!PSD.letThrough)) {
            if (!db._state.isBeingOpened) {
                if (!db._options.autoOpen)
                    return rejection(new exceptions.DatabaseClosed());
                db.open().catch(nop);
            }
            return db._state.dbReadyPromise.then(function () { return tempTransaction(db, mode, storeNames, fn); });
        }
        else {
            var trans = db._createTransaction(mode, storeNames, db._dbSchema);
            try {
                trans.create();
            }
            catch (ex) {
                return rejection(ex);
            }
            return trans._promise(mode, function (resolve, reject) {
                return newScope(function () {
                    PSD.trans = trans;
                    return fn(resolve, reject, trans);
                });
            }).then(function (result) {
                return trans._completion.then(function () { return result; });
            });
        }
    }

    var DEXIE_VERSION = '3.0.2';
    var maxString = String.fromCharCode(65535);
    var minKey = -Infinity;
    var INVALID_KEY_ARGUMENT = "Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.";
    var STRING_EXPECTED = "String expected.";
    var connections = [];
    var isIEOrEdge = typeof navigator !== 'undefined' && /(MSIE|Trident|Edge)/.test(navigator.userAgent);
    var hasIEDeleteObjectStoreBug = isIEOrEdge;
    var hangsOnDeleteLargeKeyRange = isIEOrEdge;
    var dexieStackFrameFilter = function (frame) { return !/(dexie\.js|dexie\.min\.js)/.test(frame); };
    var DBNAMES_DB = '__dbnames';
    var READONLY = 'readonly';
    var READWRITE = 'readwrite';

    function combine(filter1, filter2) {
        return filter1 ?
            filter2 ?
                function () { return filter1.apply(this, arguments) && filter2.apply(this, arguments); } :
                filter1 :
            filter2;
    }

    var AnyRange = {
        type: 3          ,
        lower: -Infinity,
        lowerOpen: false,
        upper: [[]],
        upperOpen: false
    };

    var Table =               (function () {
        function Table() {
        }
        Table.prototype._trans = function (mode, fn, writeLocked) {
            var trans = this._tx || PSD.trans;
            var tableName = this.name;
            function checkTableInTransaction(resolve, reject, trans) {
                if (!trans.schema[tableName])
                    throw new exceptions.NotFound("Table " + tableName + " not part of transaction");
                return fn(trans.idbtrans, trans);
            }
            var wasRootExec = beginMicroTickScope();
            try {
                return trans && trans.db === this.db ?
                    trans === PSD.trans ?
                        trans._promise(mode, checkTableInTransaction, writeLocked) :
                        newScope(function () { return trans._promise(mode, checkTableInTransaction, writeLocked); }, { trans: trans, transless: PSD.transless || PSD }) :
                    tempTransaction(this.db, mode, [this.name], checkTableInTransaction);
            }
            finally {
                if (wasRootExec)
                    endMicroTickScope();
            }
        };
        Table.prototype.get = function (keyOrCrit, cb) {
            var _this = this;
            if (keyOrCrit && keyOrCrit.constructor === Object)
                return this.where(keyOrCrit).first(cb);
            return this._trans('readonly', function (trans) {
                return _this.core.get({ trans: trans, key: keyOrCrit })
                    .then(function (res) { return _this.hook.reading.fire(res); });
            }).then(cb);
        };
        Table.prototype.where = function (indexOrCrit) {
            if (typeof indexOrCrit === 'string')
                return new this.db.WhereClause(this, indexOrCrit);
            if (isArray(indexOrCrit))
                return new this.db.WhereClause(this, "[" + indexOrCrit.join('+') + "]");
            var keyPaths = keys(indexOrCrit);
            if (keyPaths.length === 1)
                return this
                    .where(keyPaths[0])
                    .equals(indexOrCrit[keyPaths[0]]);
            var compoundIndex = this.schema.indexes.concat(this.schema.primKey).filter(function (ix) {
                return ix.compound &&
                    keyPaths.every(function (keyPath) { return ix.keyPath.indexOf(keyPath) >= 0; }) &&
                    ix.keyPath.every(function (keyPath) { return keyPaths.indexOf(keyPath) >= 0; });
            })[0];
            if (compoundIndex && this.db._maxKey !== maxString)
                return this
                    .where(compoundIndex.name)
                    .equals(compoundIndex.keyPath.map(function (kp) { return indexOrCrit[kp]; }));
            if (!compoundIndex && debug)
                console.warn("The query " + JSON.stringify(indexOrCrit) + " on " + this.name + " would benefit of a " +
                    ("compound index [" + keyPaths.join('+') + "]"));
            var idxByName = this.schema.idxByName;
            var idb = this.db._deps.indexedDB;
            function equals(a, b) {
                try {
                    return idb.cmp(a, b) === 0;
                }
                catch (e) {
                    return false;
                }
            }
            var _a = keyPaths.reduce(function (_a, keyPath) {
                var prevIndex = _a[0], prevFilterFn = _a[1];
                var index = idxByName[keyPath];
                var value = indexOrCrit[keyPath];
                return [
                    prevIndex || index,
                    prevIndex || !index ?
                        combine(prevFilterFn, index && index.multi ?
                            function (x) {
                                var prop = getByKeyPath(x, keyPath);
                                return isArray(prop) && prop.some(function (item) { return equals(value, item); });
                            } : function (x) { return equals(value, getByKeyPath(x, keyPath)); })
                        : prevFilterFn
                ];
            }, [null, null]), idx = _a[0], filterFunction = _a[1];
            return idx ?
                this.where(idx.name).equals(indexOrCrit[idx.keyPath])
                    .filter(filterFunction) :
                compoundIndex ?
                    this.filter(filterFunction) :
                    this.where(keyPaths).equals('');
        };
        Table.prototype.filter = function (filterFunction) {
            return this.toCollection().and(filterFunction);
        };
        Table.prototype.count = function (thenShortcut) {
            return this.toCollection().count(thenShortcut);
        };
        Table.prototype.offset = function (offset) {
            return this.toCollection().offset(offset);
        };
        Table.prototype.limit = function (numRows) {
            return this.toCollection().limit(numRows);
        };
        Table.prototype.each = function (callback) {
            return this.toCollection().each(callback);
        };
        Table.prototype.toArray = function (thenShortcut) {
            return this.toCollection().toArray(thenShortcut);
        };
        Table.prototype.toCollection = function () {
            return new this.db.Collection(new this.db.WhereClause(this));
        };
        Table.prototype.orderBy = function (index) {
            return new this.db.Collection(new this.db.WhereClause(this, isArray(index) ?
                "[" + index.join('+') + "]" :
                index));
        };
        Table.prototype.reverse = function () {
            return this.toCollection().reverse();
        };
        Table.prototype.mapToClass = function (constructor) {
            this.schema.mappedClass = constructor;
            var readHook = function (obj) {
                if (!obj)
                    return obj;
                var res = Object.create(constructor.prototype);
                for (var m in obj)
                    if (hasOwn(obj, m))
                        try {
                            res[m] = obj[m];
                        }
                        catch (_) { }
                return res;
            };
            if (this.schema.readHook) {
                this.hook.reading.unsubscribe(this.schema.readHook);
            }
            this.schema.readHook = readHook;
            this.hook("reading", readHook);
            return constructor;
        };
        Table.prototype.defineClass = function () {
            function Class(content) {
                extend(this, content);
            }
            
            return this.mapToClass(Class);
        };
        Table.prototype.add = function (obj, key) {
            var _this = this;
            return this._trans('readwrite', function (trans) {
                return _this.core.mutate({ trans: trans, type: 'add', keys: key != null ? [key] : null, values: [obj] });
            }).then(function (res) { return res.numFailures ? DexiePromise.reject(res.failures[0]) : res.lastResult; })
                .then(function (lastResult) {
                if (!_this.core.schema.primaryKey.outbound) {
                    try {
                        setByKeyPath(obj, _this.core.schema.primaryKey.keyPath, lastResult);
                    }
                    catch (_) { }
                    
                }
                return lastResult;
            });
        };
        Table.prototype.update = function (keyOrObject, modifications) {
            if (typeof modifications !== 'object' || isArray(modifications))
                throw new exceptions.InvalidArgument("Modifications must be an object.");
            if (typeof keyOrObject === 'object' && !isArray(keyOrObject)) {
                keys(modifications).forEach(function (keyPath) {
                    setByKeyPath(keyOrObject, keyPath, modifications[keyPath]);
                });
                var key = getByKeyPath(keyOrObject, this.schema.primKey.keyPath);
                if (key === undefined)
                    return rejection(new exceptions.InvalidArgument("Given object does not contain its primary key"));
                return this.where(":id").equals(key).modify(modifications);
            }
            else {
                return this.where(":id").equals(keyOrObject).modify(modifications);
            }
        };
        Table.prototype.put = function (obj, key) {
            var _this = this;
            return this._trans('readwrite', function (trans) { return _this.core.mutate({ trans: trans, type: 'put', values: [obj], keys: key != null ? [key] : null }); })
                .then(function (res) { return res.numFailures ? DexiePromise.reject(res.failures[0]) : res.lastResult; })
                .then(function (lastResult) {
                if (!_this.core.schema.primaryKey.outbound) {
                    try {
                        setByKeyPath(obj, _this.core.schema.primaryKey.keyPath, lastResult);
                    }
                    catch (_) { }
                    
                }
                return lastResult;
            });
        };
        Table.prototype.delete = function (key) {
            var _this = this;
            return this._trans('readwrite', function (trans) { return _this.core.mutate({ trans: trans, type: 'delete', keys: [key] }); })
                .then(function (res) { return res.numFailures ? DexiePromise.reject(res.failures[0]) : undefined; });
        };
        Table.prototype.clear = function () {
            var _this = this;
            return this._trans('readwrite', function (trans) { return _this.core.mutate({ trans: trans, type: 'deleteRange', range: AnyRange }); })
                .then(function (res) { return res.numFailures ? DexiePromise.reject(res.failures[0]) : undefined; });
        };
        Table.prototype.bulkGet = function (keys$$1) {
            var _this = this;
            return this._trans('readonly', function (trans) {
                return _this.core.getMany({
                    keys: keys$$1,
                    trans: trans
                }).then(function (result) { return result.map(function (res) { return _this.hook.reading.fire(res); }); });
            });
        };
        Table.prototype.bulkAdd = function (objects, keysOrOptions, options) {
            var _this = this;
            var keys$$1 = Array.isArray(keysOrOptions) ? keysOrOptions : undefined;
            options = options || (keys$$1 ? undefined : keysOrOptions);
            var wantResults = options ? options.allKeys : undefined;
            return this._trans('readwrite', function (trans) {
                var outbound = _this.core.schema.primaryKey.outbound;
                if (!outbound && keys$$1)
                    throw new exceptions.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");
                if (keys$$1 && keys$$1.length !== objects.length)
                    throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
                var numObjects = objects.length;
                return _this.core.mutate({ trans: trans, type: 'add', keys: keys$$1, values: objects, wantResults: wantResults })
                    .then(function (_a) {
                    var numFailures = _a.numFailures, results = _a.results, lastResult = _a.lastResult, failures = _a.failures;
                    var result = wantResults ? results : lastResult;
                    if (numFailures === 0)
                        return result;
                    throw new BulkError(_this.name + ".bulkAdd(): " + numFailures + " of " + numObjects + " operations failed", Object.keys(failures).map(function (pos) { return failures[pos]; }));
                });
            });
        };
        Table.prototype.bulkPut = function (objects, keysOrOptions, options) {
            var _this = this;
            var keys$$1 = Array.isArray(keysOrOptions) ? keysOrOptions : undefined;
            options = options || (keys$$1 ? undefined : keysOrOptions);
            var wantResults = options ? options.allKeys : undefined;
            return this._trans('readwrite', function (trans) {
                var outbound = _this.core.schema.primaryKey.outbound;
                if (!outbound && keys$$1)
                    throw new exceptions.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");
                if (keys$$1 && keys$$1.length !== objects.length)
                    throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
                var numObjects = objects.length;
                return _this.core.mutate({ trans: trans, type: 'put', keys: keys$$1, values: objects, wantResults: wantResults })
                    .then(function (_a) {
                    var numFailures = _a.numFailures, results = _a.results, lastResult = _a.lastResult, failures = _a.failures;
                    var result = wantResults ? results : lastResult;
                    if (numFailures === 0)
                        return result;
                    throw new BulkError(_this.name + ".bulkPut(): " + numFailures + " of " + numObjects + " operations failed", Object.keys(failures).map(function (pos) { return failures[pos]; }));
                });
            });
        };
        Table.prototype.bulkDelete = function (keys$$1) {
            var _this = this;
            var numKeys = keys$$1.length;
            return this._trans('readwrite', function (trans) {
                return _this.core.mutate({ trans: trans, type: 'delete', keys: keys$$1 });
            }).then(function (_a) {
                var numFailures = _a.numFailures, lastResult = _a.lastResult, failures = _a.failures;
                if (numFailures === 0)
                    return lastResult;
                throw new BulkError(_this.name + ".bulkDelete(): " + numFailures + " of " + numKeys + " operations failed", failures);
            });
        };
        return Table;
    }());

    function Events(ctx) {
        var evs = {};
        var rv = function (eventName, subscriber) {
            if (subscriber) {
                var i = arguments.length, args = new Array(i - 1);
                while (--i)
                    args[i - 1] = arguments[i];
                evs[eventName].subscribe.apply(null, args);
                return ctx;
            }
            else if (typeof (eventName) === 'string') {
                return evs[eventName];
            }
        };
        rv.addEventType = add;
        for (var i = 1, l = arguments.length; i < l; ++i) {
            add(arguments[i]);
        }
        return rv;
        function add(eventName, chainFunction, defaultFunction) {
            if (typeof eventName === 'object')
                return addConfiguredEvents(eventName);
            if (!chainFunction)
                chainFunction = reverseStoppableEventChain;
            if (!defaultFunction)
                defaultFunction = nop;
            var context = {
                subscribers: [],
                fire: defaultFunction,
                subscribe: function (cb) {
                    if (context.subscribers.indexOf(cb) === -1) {
                        context.subscribers.push(cb);
                        context.fire = chainFunction(context.fire, cb);
                    }
                },
                unsubscribe: function (cb) {
                    context.subscribers = context.subscribers.filter(function (fn) { return fn !== cb; });
                    context.fire = context.subscribers.reduce(chainFunction, defaultFunction);
                }
            };
            evs[eventName] = rv[eventName] = context;
            return context;
        }
        function addConfiguredEvents(cfg) {
            keys(cfg).forEach(function (eventName) {
                var args = cfg[eventName];
                if (isArray(args)) {
                    add(eventName, cfg[eventName][0], cfg[eventName][1]);
                }
                else if (args === 'asap') {
                    var context = add(eventName, mirror, function fire() {
                        var i = arguments.length, args = new Array(i);
                        while (i--)
                            args[i] = arguments[i];
                        context.subscribers.forEach(function (fn) {
                            asap(function fireEvent() {
                                fn.apply(null, args);
                            });
                        });
                    });
                }
                else
                    throw new exceptions.InvalidArgument("Invalid event config");
            });
        }
    }

    function makeClassConstructor(prototype, constructor) {
        derive(constructor).from({ prototype: prototype });
        return constructor;
    }

    function createTableConstructor(db) {
        return makeClassConstructor(Table.prototype, function Table$$1(name, tableSchema, trans) {
            this.db = db;
            this._tx = trans;
            this.name = name;
            this.schema = tableSchema;
            this.hook = db._allTables[name] ? db._allTables[name].hook : Events(null, {
                "creating": [hookCreatingChain, nop],
                "reading": [pureFunctionChain, mirror],
                "updating": [hookUpdatingChain, nop],
                "deleting": [hookDeletingChain, nop]
            });
        });
    }

    function isPlainKeyRange(ctx, ignoreLimitFilter) {
        return !(ctx.filter || ctx.algorithm || ctx.or) &&
            (ignoreLimitFilter ? ctx.justLimit : !ctx.replayFilter);
    }
    function addFilter(ctx, fn) {
        ctx.filter = combine(ctx.filter, fn);
    }
    function addReplayFilter(ctx, factory, isLimitFilter) {
        var curr = ctx.replayFilter;
        ctx.replayFilter = curr ? function () { return combine(curr(), factory()); } : factory;
        ctx.justLimit = isLimitFilter && !curr;
    }
    function addMatchFilter(ctx, fn) {
        ctx.isMatch = combine(ctx.isMatch, fn);
    }
    function getIndexOrStore(ctx, coreSchema) {
        if (ctx.isPrimKey)
            return coreSchema.primaryKey;
        var index = coreSchema.getIndexByKeyPath(ctx.index);
        if (!index)
            throw new exceptions.Schema("KeyPath " + ctx.index + " on object store " + coreSchema.name + " is not indexed");
        return index;
    }
    function openCursor(ctx, coreTable, trans) {
        var index = getIndexOrStore(ctx, coreTable.schema);
        return coreTable.openCursor({
            trans: trans,
            values: !ctx.keysOnly,
            reverse: ctx.dir === 'prev',
            unique: !!ctx.unique,
            query: {
                index: index,
                range: ctx.range
            }
        });
    }
    function iter(ctx, fn, coreTrans, coreTable) {
        var filter = ctx.replayFilter ? combine(ctx.filter, ctx.replayFilter()) : ctx.filter;
        if (!ctx.or) {
            return iterate(openCursor(ctx, coreTable, coreTrans), combine(ctx.algorithm, filter), fn, !ctx.keysOnly && ctx.valueMapper);
        }
        else {
            var set_1 = {};
            var union = function (item, cursor, advance) {
                if (!filter || filter(cursor, advance, function (result) { return cursor.stop(result); }, function (err) { return cursor.fail(err); })) {
                    var primaryKey = cursor.primaryKey;
                    var key = '' + primaryKey;
                    if (key === '[object ArrayBuffer]')
                        key = '' + new Uint8Array(primaryKey);
                    if (!hasOwn(set_1, key)) {
                        set_1[key] = true;
                        fn(item, cursor, advance);
                    }
                }
            };
            return Promise.all([
                ctx.or._iterate(union, coreTrans),
                iterate(openCursor(ctx, coreTable, coreTrans), ctx.algorithm, union, !ctx.keysOnly && ctx.valueMapper)
            ]);
        }
    }
    function iterate(cursorPromise, filter, fn, valueMapper) {
        var mappedFn = valueMapper ? function (x, c, a) { return fn(valueMapper(x), c, a); } : fn;
        var wrappedFn = wrap(mappedFn);
        return cursorPromise.then(function (cursor) {
            if (cursor) {
                return cursor.start(function () {
                    var c = function () { return cursor.continue(); };
                    if (!filter || filter(cursor, function (advancer) { return c = advancer; }, function (val) { cursor.stop(val); c = nop; }, function (e) { cursor.fail(e); c = nop; }))
                        wrappedFn(cursor.value, cursor, function (advancer) { return c = advancer; });
                    c();
                });
            }
        });
    }

    var Collection =               (function () {
        function Collection() {
        }
        Collection.prototype._read = function (fn, cb) {
            var ctx = this._ctx;
            return ctx.error ?
                ctx.table._trans(null, rejection.bind(null, ctx.error)) :
                ctx.table._trans('readonly', fn).then(cb);
        };
        Collection.prototype._write = function (fn) {
            var ctx = this._ctx;
            return ctx.error ?
                ctx.table._trans(null, rejection.bind(null, ctx.error)) :
                ctx.table._trans('readwrite', fn, "locked");
        };
        Collection.prototype._addAlgorithm = function (fn) {
            var ctx = this._ctx;
            ctx.algorithm = combine(ctx.algorithm, fn);
        };
        Collection.prototype._iterate = function (fn, coreTrans) {
            return iter(this._ctx, fn, coreTrans, this._ctx.table.core);
        };
        Collection.prototype.clone = function (props$$1) {
            var rv = Object.create(this.constructor.prototype), ctx = Object.create(this._ctx);
            if (props$$1)
                extend(ctx, props$$1);
            rv._ctx = ctx;
            return rv;
        };
        Collection.prototype.raw = function () {
            this._ctx.valueMapper = null;
            return this;
        };
        Collection.prototype.each = function (fn) {
            var ctx = this._ctx;
            return this._read(function (trans) { return iter(ctx, fn, trans, ctx.table.core); });
        };
        Collection.prototype.count = function (cb) {
            var _this = this;
            return this._read(function (trans) {
                var ctx = _this._ctx;
                var coreTable = ctx.table.core;
                if (isPlainKeyRange(ctx, true)) {
                    return coreTable.count({
                        trans: trans,
                        query: {
                            index: getIndexOrStore(ctx, coreTable.schema),
                            range: ctx.range
                        }
                    }).then(function (count) { return Math.min(count, ctx.limit); });
                }
                else {
                    var count = 0;
                    return iter(ctx, function () { ++count; return false; }, trans, coreTable)
                        .then(function () { return count; });
                }
            }).then(cb);
        };
        Collection.prototype.sortBy = function (keyPath, cb) {
            var parts = keyPath.split('.').reverse(), lastPart = parts[0], lastIndex = parts.length - 1;
            function getval(obj, i) {
                if (i)
                    return getval(obj[parts[i]], i - 1);
                return obj[lastPart];
            }
            var order = this._ctx.dir === "next" ? 1 : -1;
            function sorter(a, b) {
                var aVal = getval(a, lastIndex), bVal = getval(b, lastIndex);
                return aVal < bVal ? -order : aVal > bVal ? order : 0;
            }
            return this.toArray(function (a) {
                return a.sort(sorter);
            }).then(cb);
        };
        Collection.prototype.toArray = function (cb) {
            var _this = this;
            return this._read(function (trans) {
                var ctx = _this._ctx;
                if (ctx.dir === 'next' && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
                    var valueMapper_1 = ctx.valueMapper;
                    var index = getIndexOrStore(ctx, ctx.table.core.schema);
                    return ctx.table.core.query({
                        trans: trans,
                        limit: ctx.limit,
                        values: true,
                        query: {
                            index: index,
                            range: ctx.range
                        }
                    }).then(function (_a) {
                        var result = _a.result;
                        return valueMapper_1 ? result.map(valueMapper_1) : result;
                    });
                }
                else {
                    var a_1 = [];
                    return iter(ctx, function (item) { return a_1.push(item); }, trans, ctx.table.core).then(function () { return a_1; });
                }
            }, cb);
        };
        Collection.prototype.offset = function (offset) {
            var ctx = this._ctx;
            if (offset <= 0)
                return this;
            ctx.offset += offset;
            if (isPlainKeyRange(ctx)) {
                addReplayFilter(ctx, function () {
                    var offsetLeft = offset;
                    return function (cursor, advance) {
                        if (offsetLeft === 0)
                            return true;
                        if (offsetLeft === 1) {
                            --offsetLeft;
                            return false;
                        }
                        advance(function () {
                            cursor.advance(offsetLeft);
                            offsetLeft = 0;
                        });
                        return false;
                    };
                });
            }
            else {
                addReplayFilter(ctx, function () {
                    var offsetLeft = offset;
                    return function () { return (--offsetLeft < 0); };
                });
            }
            return this;
        };
        Collection.prototype.limit = function (numRows) {
            this._ctx.limit = Math.min(this._ctx.limit, numRows);
            addReplayFilter(this._ctx, function () {
                var rowsLeft = numRows;
                return function (cursor, advance, resolve) {
                    if (--rowsLeft <= 0)
                        advance(resolve);
                    return rowsLeft >= 0;
                };
            }, true);
            return this;
        };
        Collection.prototype.until = function (filterFunction, bIncludeStopEntry) {
            addFilter(this._ctx, function (cursor, advance, resolve) {
                if (filterFunction(cursor.value)) {
                    advance(resolve);
                    return bIncludeStopEntry;
                }
                else {
                    return true;
                }
            });
            return this;
        };
        Collection.prototype.first = function (cb) {
            return this.limit(1).toArray(function (a) { return a[0]; }).then(cb);
        };
        Collection.prototype.last = function (cb) {
            return this.reverse().first(cb);
        };
        Collection.prototype.filter = function (filterFunction) {
            addFilter(this._ctx, function (cursor) {
                return filterFunction(cursor.value);
            });
            addMatchFilter(this._ctx, filterFunction);
            return this;
        };
        Collection.prototype.and = function (filter) {
            return this.filter(filter);
        };
        Collection.prototype.or = function (indexName) {
            return new this.db.WhereClause(this._ctx.table, indexName, this);
        };
        Collection.prototype.reverse = function () {
            this._ctx.dir = (this._ctx.dir === "prev" ? "next" : "prev");
            if (this._ondirectionchange)
                this._ondirectionchange(this._ctx.dir);
            return this;
        };
        Collection.prototype.desc = function () {
            return this.reverse();
        };
        Collection.prototype.eachKey = function (cb) {
            var ctx = this._ctx;
            ctx.keysOnly = !ctx.isMatch;
            return this.each(function (val, cursor) { cb(cursor.key, cursor); });
        };
        Collection.prototype.eachUniqueKey = function (cb) {
            this._ctx.unique = "unique";
            return this.eachKey(cb);
        };
        Collection.prototype.eachPrimaryKey = function (cb) {
            var ctx = this._ctx;
            ctx.keysOnly = !ctx.isMatch;
            return this.each(function (val, cursor) { cb(cursor.primaryKey, cursor); });
        };
        Collection.prototype.keys = function (cb) {
            var ctx = this._ctx;
            ctx.keysOnly = !ctx.isMatch;
            var a = [];
            return this.each(function (item, cursor) {
                a.push(cursor.key);
            }).then(function () {
                return a;
            }).then(cb);
        };
        Collection.prototype.primaryKeys = function (cb) {
            var ctx = this._ctx;
            if (ctx.dir === 'next' && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
                return this._read(function (trans) {
                    var index = getIndexOrStore(ctx, ctx.table.core.schema);
                    return ctx.table.core.query({
                        trans: trans,
                        values: false,
                        limit: ctx.limit,
                        query: {
                            index: index,
                            range: ctx.range
                        }
                    });
                }).then(function (_a) {
                    var result = _a.result;
                    return result;
                }).then(cb);
            }
            ctx.keysOnly = !ctx.isMatch;
            var a = [];
            return this.each(function (item, cursor) {
                a.push(cursor.primaryKey);
            }).then(function () {
                return a;
            }).then(cb);
        };
        Collection.prototype.uniqueKeys = function (cb) {
            this._ctx.unique = "unique";
            return this.keys(cb);
        };
        Collection.prototype.firstKey = function (cb) {
            return this.limit(1).keys(function (a) { return a[0]; }).then(cb);
        };
        Collection.prototype.lastKey = function (cb) {
            return this.reverse().firstKey(cb);
        };
        Collection.prototype.distinct = function () {
            var ctx = this._ctx, idx = ctx.index && ctx.table.schema.idxByName[ctx.index];
            if (!idx || !idx.multi)
                return this;
            var set = {};
            addFilter(this._ctx, function (cursor) {
                var strKey = cursor.primaryKey.toString();
                var found = hasOwn(set, strKey);
                set[strKey] = true;
                return !found;
            });
            return this;
        };
        Collection.prototype.modify = function (changes) {
            var _this = this;
            var ctx = this._ctx;
            return this._write(function (trans) {
                var modifyer;
                if (typeof changes === 'function') {
                    modifyer = changes;
                }
                else {
                    var keyPaths = keys(changes);
                    var numKeys = keyPaths.length;
                    modifyer = function (item) {
                        var anythingModified = false;
                        for (var i = 0; i < numKeys; ++i) {
                            var keyPath = keyPaths[i], val = changes[keyPath];
                            if (getByKeyPath(item, keyPath) !== val) {
                                setByKeyPath(item, keyPath, val);
                                anythingModified = true;
                            }
                        }
                        return anythingModified;
                    };
                }
                var coreTable = ctx.table.core;
                var _a = coreTable.schema.primaryKey, outbound = _a.outbound, extractKey = _a.extractKey;
                var limit = 'testmode' in Dexie ? 1 : 2000;
                var cmp = _this.db.core.cmp;
                var totalFailures = [];
                var successCount = 0;
                var failedKeys = [];
                var applyMutateResult = function (expectedCount, res) {
                    var failures = res.failures, numFailures = res.numFailures;
                    successCount += expectedCount - numFailures;
                    for (var _i = 0, _a = keys(failures); _i < _a.length; _i++) {
                        var pos = _a[_i];
                        totalFailures.push(failures[pos]);
                    }
                };
                return _this.clone().primaryKeys().then(function (keys$$1) {
                    var nextChunk = function (offset) {
                        var count = Math.min(limit, keys$$1.length - offset);
                        return coreTable.getMany({ trans: trans, keys: keys$$1.slice(offset, offset + count) }).then(function (values) {
                            var addValues = [];
                            var putValues = [];
                            var putKeys = outbound ? [] : null;
                            var deleteKeys = [];
                            for (var i = 0; i < count; ++i) {
                                var origValue = values[i];
                                var ctx_1 = {
                                    value: deepClone(origValue),
                                    primKey: keys$$1[offset + i]
                                };
                                if (modifyer.call(ctx_1, ctx_1.value, ctx_1) !== false) {
                                    if (ctx_1.value == null) {
                                        deleteKeys.push(keys$$1[offset + i]);
                                    }
                                    else if (!outbound && cmp(extractKey(origValue), extractKey(ctx_1.value)) !== 0) {
                                        deleteKeys.push(keys$$1[offset + i]);
                                        addValues.push(ctx_1.value);
                                    }
                                    else {
                                        putValues.push(ctx_1.value);
                                        if (outbound)
                                            putKeys.push(keys$$1[offset + i]);
                                    }
                                }
                            }
                            return Promise.resolve(addValues.length > 0 &&
                                coreTable.mutate({ trans: trans, type: 'add', values: addValues })
                                    .then(function (res) {
                                    for (var pos in res.failures) {
                                        deleteKeys.splice(parseInt(pos), 1);
                                    }
                                    applyMutateResult(addValues.length, res);
                                })).then(function (res) { return putValues.length > 0 &&
                                coreTable.mutate({ trans: trans, type: 'put', keys: putKeys, values: putValues })
                                    .then(function (res) { return applyMutateResult(putValues.length, res); }); }).then(function () { return deleteKeys.length > 0 &&
                                coreTable.mutate({ trans: trans, type: 'delete', keys: deleteKeys })
                                    .then(function (res) { return applyMutateResult(deleteKeys.length, res); }); }).then(function () {
                                return keys$$1.length > offset + count && nextChunk(offset + limit);
                            });
                        });
                    };
                    return nextChunk(0).then(function () {
                        if (totalFailures.length > 0)
                            throw new ModifyError("Error modifying one or more objects", totalFailures, successCount, failedKeys);
                        return keys$$1.length;
                    });
                });
            });
        };
        Collection.prototype.delete = function () {
            var ctx = this._ctx, range = ctx.range;
            if (isPlainKeyRange(ctx) &&
                ((ctx.isPrimKey && !hangsOnDeleteLargeKeyRange) || range.type === 3          ))
             {
                return this._write(function (trans) {
                    var primaryKey = ctx.table.core.schema.primaryKey;
                    var coreRange = range;
                    return ctx.table.core.count({ trans: trans, query: { index: primaryKey, range: coreRange } }).then(function (count) {
                        return ctx.table.core.mutate({ trans: trans, type: 'deleteRange', range: coreRange })
                            .then(function (_a) {
                            var failures = _a.failures, lastResult = _a.lastResult, results = _a.results, numFailures = _a.numFailures;
                            if (numFailures)
                                throw new ModifyError("Could not delete some values", Object.keys(failures).map(function (pos) { return failures[pos]; }), count - numFailures);
                            return count - numFailures;
                        });
                    });
                });
            }
            return this.modify(function (value, ctx) { return ctx.value = null; });
        };
        return Collection;
    }());

    function createCollectionConstructor(db) {
        return makeClassConstructor(Collection.prototype, function Collection$$1(whereClause, keyRangeGenerator) {
            this.db = db;
            var keyRange = AnyRange, error = null;
            if (keyRangeGenerator)
                try {
                    keyRange = keyRangeGenerator();
                }
                catch (ex) {
                    error = ex;
                }
            var whereCtx = whereClause._ctx;
            var table = whereCtx.table;
            var readingHook = table.hook.reading.fire;
            this._ctx = {
                table: table,
                index: whereCtx.index,
                isPrimKey: (!whereCtx.index || (table.schema.primKey.keyPath && whereCtx.index === table.schema.primKey.name)),
                range: keyRange,
                keysOnly: false,
                dir: "next",
                unique: "",
                algorithm: null,
                filter: null,
                replayFilter: null,
                justLimit: true,
                isMatch: null,
                offset: 0,
                limit: Infinity,
                error: error,
                or: whereCtx.or,
                valueMapper: readingHook !== mirror ? readingHook : null
            };
        });
    }

    function simpleCompare(a, b) {
        return a < b ? -1 : a === b ? 0 : 1;
    }
    function simpleCompareReverse(a, b) {
        return a > b ? -1 : a === b ? 0 : 1;
    }

    function fail(collectionOrWhereClause, err, T) {
        var collection = collectionOrWhereClause instanceof WhereClause ?
            new collectionOrWhereClause.Collection(collectionOrWhereClause) :
            collectionOrWhereClause;
        collection._ctx.error = T ? new T(err) : new TypeError(err);
        return collection;
    }
    function emptyCollection(whereClause) {
        return new whereClause.Collection(whereClause, function () { return rangeEqual(""); }).limit(0);
    }
    function upperFactory(dir) {
        return dir === "next" ?
            function (s) { return s.toUpperCase(); } :
            function (s) { return s.toLowerCase(); };
    }
    function lowerFactory(dir) {
        return dir === "next" ?
            function (s) { return s.toLowerCase(); } :
            function (s) { return s.toUpperCase(); };
    }
    function nextCasing(key, lowerKey, upperNeedle, lowerNeedle, cmp, dir) {
        var length = Math.min(key.length, lowerNeedle.length);
        var llp = -1;
        for (var i = 0; i < length; ++i) {
            var lwrKeyChar = lowerKey[i];
            if (lwrKeyChar !== lowerNeedle[i]) {
                if (cmp(key[i], upperNeedle[i]) < 0)
                    return key.substr(0, i) + upperNeedle[i] + upperNeedle.substr(i + 1);
                if (cmp(key[i], lowerNeedle[i]) < 0)
                    return key.substr(0, i) + lowerNeedle[i] + upperNeedle.substr(i + 1);
                if (llp >= 0)
                    return key.substr(0, llp) + lowerKey[llp] + upperNeedle.substr(llp + 1);
                return null;
            }
            if (cmp(key[i], lwrKeyChar) < 0)
                llp = i;
        }
        if (length < lowerNeedle.length && dir === "next")
            return key + upperNeedle.substr(key.length);
        if (length < key.length && dir === "prev")
            return key.substr(0, upperNeedle.length);
        return (llp < 0 ? null : key.substr(0, llp) + lowerNeedle[llp] + upperNeedle.substr(llp + 1));
    }
    function addIgnoreCaseAlgorithm(whereClause, match, needles, suffix) {
        var upper, lower, compare, upperNeedles, lowerNeedles, direction, nextKeySuffix, needlesLen = needles.length;
        if (!needles.every(function (s) { return typeof s === 'string'; })) {
            return fail(whereClause, STRING_EXPECTED);
        }
        function initDirection(dir) {
            upper = upperFactory(dir);
            lower = lowerFactory(dir);
            compare = (dir === "next" ? simpleCompare : simpleCompareReverse);
            var needleBounds = needles.map(function (needle) {
                return { lower: lower(needle), upper: upper(needle) };
            }).sort(function (a, b) {
                return compare(a.lower, b.lower);
            });
            upperNeedles = needleBounds.map(function (nb) { return nb.upper; });
            lowerNeedles = needleBounds.map(function (nb) { return nb.lower; });
            direction = dir;
            nextKeySuffix = (dir === "next" ? "" : suffix);
        }
        initDirection("next");
        var c = new whereClause.Collection(whereClause, function () { return createRange(upperNeedles[0], lowerNeedles[needlesLen - 1] + suffix); });
        c._ondirectionchange = function (direction) {
            initDirection(direction);
        };
        var firstPossibleNeedle = 0;
        c._addAlgorithm(function (cursor, advance, resolve) {
            var key = cursor.key;
            if (typeof key !== 'string')
                return false;
            var lowerKey = lower(key);
            if (match(lowerKey, lowerNeedles, firstPossibleNeedle)) {
                return true;
            }
            else {
                var lowestPossibleCasing = null;
                for (var i = firstPossibleNeedle; i < needlesLen; ++i) {
                    var casing = nextCasing(key, lowerKey, upperNeedles[i], lowerNeedles[i], compare, direction);
                    if (casing === null && lowestPossibleCasing === null)
                        firstPossibleNeedle = i + 1;
                    else if (lowestPossibleCasing === null || compare(lowestPossibleCasing, casing) > 0) {
                        lowestPossibleCasing = casing;
                    }
                }
                if (lowestPossibleCasing !== null) {
                    advance(function () { cursor.continue(lowestPossibleCasing + nextKeySuffix); });
                }
                else {
                    advance(resolve);
                }
                return false;
            }
        });
        return c;
    }
    function createRange(lower, upper, lowerOpen, upperOpen) {
        return {
            type: 2            ,
            lower: lower,
            upper: upper,
            lowerOpen: lowerOpen,
            upperOpen: upperOpen
        };
    }
    function rangeEqual(value) {
        return {
            type: 1            ,
            lower: value,
            upper: value
        };
    }

    var WhereClause =               (function () {
        function WhereClause() {
        }
        Object.defineProperty(WhereClause.prototype, "Collection", {
            get: function () {
                return this._ctx.table.db.Collection;
            },
            enumerable: true,
            configurable: true
        });
        WhereClause.prototype.between = function (lower, upper, includeLower, includeUpper) {
            includeLower = includeLower !== false;
            includeUpper = includeUpper === true;
            try {
                if ((this._cmp(lower, upper) > 0) ||
                    (this._cmp(lower, upper) === 0 && (includeLower || includeUpper) && !(includeLower && includeUpper)))
                    return emptyCollection(this);
                return new this.Collection(this, function () { return createRange(lower, upper, !includeLower, !includeUpper); });
            }
            catch (e) {
                return fail(this, INVALID_KEY_ARGUMENT);
            }
        };
        WhereClause.prototype.equals = function (value) {
            return new this.Collection(this, function () { return rangeEqual(value); });
        };
        WhereClause.prototype.above = function (value) {
            if (value == null)
                return fail(this, INVALID_KEY_ARGUMENT);
            return new this.Collection(this, function () { return createRange(value, undefined, true); });
        };
        WhereClause.prototype.aboveOrEqual = function (value) {
            if (value == null)
                return fail(this, INVALID_KEY_ARGUMENT);
            return new this.Collection(this, function () { return createRange(value, undefined, false); });
        };
        WhereClause.prototype.below = function (value) {
            if (value == null)
                return fail(this, INVALID_KEY_ARGUMENT);
            return new this.Collection(this, function () { return createRange(undefined, value, false, true); });
        };
        WhereClause.prototype.belowOrEqual = function (value) {
            if (value == null)
                return fail(this, INVALID_KEY_ARGUMENT);
            return new this.Collection(this, function () { return createRange(undefined, value); });
        };
        WhereClause.prototype.startsWith = function (str) {
            if (typeof str !== 'string')
                return fail(this, STRING_EXPECTED);
            return this.between(str, str + maxString, true, true);
        };
        WhereClause.prototype.startsWithIgnoreCase = function (str) {
            if (str === "")
                return this.startsWith(str);
            return addIgnoreCaseAlgorithm(this, function (x, a) { return x.indexOf(a[0]) === 0; }, [str], maxString);
        };
        WhereClause.prototype.equalsIgnoreCase = function (str) {
            return addIgnoreCaseAlgorithm(this, function (x, a) { return x === a[0]; }, [str], "");
        };
        WhereClause.prototype.anyOfIgnoreCase = function () {
            var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
            if (set.length === 0)
                return emptyCollection(this);
            return addIgnoreCaseAlgorithm(this, function (x, a) { return a.indexOf(x) !== -1; }, set, "");
        };
        WhereClause.prototype.startsWithAnyOfIgnoreCase = function () {
            var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
            if (set.length === 0)
                return emptyCollection(this);
            return addIgnoreCaseAlgorithm(this, function (x, a) { return a.some(function (n) { return x.indexOf(n) === 0; }); }, set, maxString);
        };
        WhereClause.prototype.anyOf = function () {
            var _this = this;
            var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
            var compare = this._cmp;
            try {
                set.sort(compare);
            }
            catch (e) {
                return fail(this, INVALID_KEY_ARGUMENT);
            }
            if (set.length === 0)
                return emptyCollection(this);
            var c = new this.Collection(this, function () { return createRange(set[0], set[set.length - 1]); });
            c._ondirectionchange = function (direction) {
                compare = (direction === "next" ?
                    _this._ascending :
                    _this._descending);
                set.sort(compare);
            };
            var i = 0;
            c._addAlgorithm(function (cursor, advance, resolve) {
                var key = cursor.key;
                while (compare(key, set[i]) > 0) {
                    ++i;
                    if (i === set.length) {
                        advance(resolve);
                        return false;
                    }
                }
                if (compare(key, set[i]) === 0) {
                    return true;
                }
                else {
                    advance(function () { cursor.continue(set[i]); });
                    return false;
                }
            });
            return c;
        };
        WhereClause.prototype.notEqual = function (value) {
            return this.inAnyRange([[minKey, value], [value, this.db._maxKey]], { includeLowers: false, includeUppers: false });
        };
        WhereClause.prototype.noneOf = function () {
            var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
            if (set.length === 0)
                return new this.Collection(this);
            try {
                set.sort(this._ascending);
            }
            catch (e) {
                return fail(this, INVALID_KEY_ARGUMENT);
            }
            var ranges = set.reduce(function (res, val) { return res ?
                res.concat([[res[res.length - 1][1], val]]) :
                [[minKey, val]]; }, null);
            ranges.push([set[set.length - 1], this.db._maxKey]);
            return this.inAnyRange(ranges, { includeLowers: false, includeUppers: false });
        };
        WhereClause.prototype.inAnyRange = function (ranges, options) {
            var _this = this;
            var cmp = this._cmp, ascending = this._ascending, descending = this._descending, min = this._min, max = this._max;
            if (ranges.length === 0)
                return emptyCollection(this);
            if (!ranges.every(function (range) {
                return range[0] !== undefined &&
                    range[1] !== undefined &&
                    ascending(range[0], range[1]) <= 0;
            })) {
                return fail(this, "First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower", exceptions.InvalidArgument);
            }
            var includeLowers = !options || options.includeLowers !== false;
            var includeUppers = options && options.includeUppers === true;
            function addRange(ranges, newRange) {
                var i = 0, l = ranges.length;
                for (; i < l; ++i) {
                    var range = ranges[i];
                    if (cmp(newRange[0], range[1]) < 0 && cmp(newRange[1], range[0]) > 0) {
                        range[0] = min(range[0], newRange[0]);
                        range[1] = max(range[1], newRange[1]);
                        break;
                    }
                }
                if (i === l)
                    ranges.push(newRange);
                return ranges;
            }
            var sortDirection = ascending;
            function rangeSorter(a, b) { return sortDirection(a[0], b[0]); }
            var set;
            try {
                set = ranges.reduce(addRange, []);
                set.sort(rangeSorter);
            }
            catch (ex) {
                return fail(this, INVALID_KEY_ARGUMENT);
            }
            var rangePos = 0;
            var keyIsBeyondCurrentEntry = includeUppers ?
                function (key) { return ascending(key, set[rangePos][1]) > 0; } :
                function (key) { return ascending(key, set[rangePos][1]) >= 0; };
            var keyIsBeforeCurrentEntry = includeLowers ?
                function (key) { return descending(key, set[rangePos][0]) > 0; } :
                function (key) { return descending(key, set[rangePos][0]) >= 0; };
            function keyWithinCurrentRange(key) {
                return !keyIsBeyondCurrentEntry(key) && !keyIsBeforeCurrentEntry(key);
            }
            var checkKey = keyIsBeyondCurrentEntry;
            var c = new this.Collection(this, function () { return createRange(set[0][0], set[set.length - 1][1], !includeLowers, !includeUppers); });
            c._ondirectionchange = function (direction) {
                if (direction === "next") {
                    checkKey = keyIsBeyondCurrentEntry;
                    sortDirection = ascending;
                }
                else {
                    checkKey = keyIsBeforeCurrentEntry;
                    sortDirection = descending;
                }
                set.sort(rangeSorter);
            };
            c._addAlgorithm(function (cursor, advance, resolve) {
                var key = cursor.key;
                while (checkKey(key)) {
                    ++rangePos;
                    if (rangePos === set.length) {
                        advance(resolve);
                        return false;
                    }
                }
                if (keyWithinCurrentRange(key)) {
                    return true;
                }
                else if (_this._cmp(key, set[rangePos][1]) === 0 || _this._cmp(key, set[rangePos][0]) === 0) {
                    return false;
                }
                else {
                    advance(function () {
                        if (sortDirection === ascending)
                            cursor.continue(set[rangePos][0]);
                        else
                            cursor.continue(set[rangePos][1]);
                    });
                    return false;
                }
            });
            return c;
        };
        WhereClause.prototype.startsWithAnyOf = function () {
            var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
            if (!set.every(function (s) { return typeof s === 'string'; })) {
                return fail(this, "startsWithAnyOf() only works with strings");
            }
            if (set.length === 0)
                return emptyCollection(this);
            return this.inAnyRange(set.map(function (str) { return [str, str + maxString]; }));
        };
        return WhereClause;
    }());

    function createWhereClauseConstructor(db) {
        return makeClassConstructor(WhereClause.prototype, function WhereClause$$1(table, index, orCollection) {
            this.db = db;
            this._ctx = {
                table: table,
                index: index === ":id" ? null : index,
                or: orCollection
            };
            var indexedDB = db._deps.indexedDB;
            if (!indexedDB)
                throw new exceptions.MissingAPI("indexedDB API missing");
            this._cmp = this._ascending = indexedDB.cmp.bind(indexedDB);
            this._descending = function (a, b) { return indexedDB.cmp(b, a); };
            this._max = function (a, b) { return indexedDB.cmp(a, b) > 0 ? a : b; };
            this._min = function (a, b) { return indexedDB.cmp(a, b) < 0 ? a : b; };
            this._IDBKeyRange = db._deps.IDBKeyRange;
        });
    }

    function safariMultiStoreFix(storeNames) {
        return storeNames.length === 1 ? storeNames[0] : storeNames;
    }

    function getMaxKey(IdbKeyRange) {
        try {
            IdbKeyRange.only([[]]);
            return [[]];
        }
        catch (e) {
            return maxString;
        }
    }

    function eventRejectHandler(reject) {
        return wrap(function (event) {
            preventDefault(event);
            reject(event.target.error);
            return false;
        });
    }



    function preventDefault(event) {
        if (event.stopPropagation)
            event.stopPropagation();
        if (event.preventDefault)
            event.preventDefault();
    }

    var Transaction =               (function () {
        function Transaction() {
        }
        Transaction.prototype._lock = function () {
            assert(!PSD.global);
            ++this._reculock;
            if (this._reculock === 1 && !PSD.global)
                PSD.lockOwnerFor = this;
            return this;
        };
        Transaction.prototype._unlock = function () {
            assert(!PSD.global);
            if (--this._reculock === 0) {
                if (!PSD.global)
                    PSD.lockOwnerFor = null;
                while (this._blockedFuncs.length > 0 && !this._locked()) {
                    var fnAndPSD = this._blockedFuncs.shift();
                    try {
                        usePSD(fnAndPSD[1], fnAndPSD[0]);
                    }
                    catch (e) { }
                }
            }
            return this;
        };
        Transaction.prototype._locked = function () {
            return this._reculock && PSD.lockOwnerFor !== this;
        };
        Transaction.prototype.create = function (idbtrans) {
            var _this = this;
            if (!this.mode)
                return this;
            var idbdb = this.db.idbdb;
            var dbOpenError = this.db._state.dbOpenError;
            assert(!this.idbtrans);
            if (!idbtrans && !idbdb) {
                switch (dbOpenError && dbOpenError.name) {
                    case "DatabaseClosedError":
                        throw new exceptions.DatabaseClosed(dbOpenError);
                    case "MissingAPIError":
                        throw new exceptions.MissingAPI(dbOpenError.message, dbOpenError);
                    default:
                        throw new exceptions.OpenFailed(dbOpenError);
                }
            }
            if (!this.active)
                throw new exceptions.TransactionInactive();
            assert(this._completion._state === null);
            idbtrans = this.idbtrans = idbtrans || idbdb.transaction(safariMultiStoreFix(this.storeNames), this.mode);
            idbtrans.onerror = wrap(function (ev) {
                preventDefault(ev);
                _this._reject(idbtrans.error);
            });
            idbtrans.onabort = wrap(function (ev) {
                preventDefault(ev);
                _this.active && _this._reject(new exceptions.Abort(idbtrans.error));
                _this.active = false;
                _this.on("abort").fire(ev);
            });
            idbtrans.oncomplete = wrap(function () {
                _this.active = false;
                _this._resolve();
            });
            return this;
        };
        Transaction.prototype._promise = function (mode, fn, bWriteLock) {
            var _this = this;
            if (mode === 'readwrite' && this.mode !== 'readwrite')
                return rejection(new exceptions.ReadOnly("Transaction is readonly"));
            if (!this.active)
                return rejection(new exceptions.TransactionInactive());
            if (this._locked()) {
                return new DexiePromise(function (resolve, reject) {
                    _this._blockedFuncs.push([function () {
                            _this._promise(mode, fn, bWriteLock).then(resolve, reject);
                        }, PSD]);
                });
            }
            else if (bWriteLock) {
                return newScope(function () {
                    var p = new DexiePromise(function (resolve, reject) {
                        _this._lock();
                        var rv = fn(resolve, reject, _this);
                        if (rv && rv.then)
                            rv.then(resolve, reject);
                    });
                    p.finally(function () { return _this._unlock(); });
                    p._lib = true;
                    return p;
                });
            }
            else {
                var p = new DexiePromise(function (resolve, reject) {
                    var rv = fn(resolve, reject, _this);
                    if (rv && rv.then)
                        rv.then(resolve, reject);
                });
                p._lib = true;
                return p;
            }
        };
        Transaction.prototype._root = function () {
            return this.parent ? this.parent._root() : this;
        };
        Transaction.prototype.waitFor = function (promiseLike) {
            var root = this._root();
            var promise = DexiePromise.resolve(promiseLike);
            if (root._waitingFor) {
                root._waitingFor = root._waitingFor.then(function () { return promise; });
            }
            else {
                root._waitingFor = promise;
                root._waitingQueue = [];
                var store = root.idbtrans.objectStore(root.storeNames[0]);
                (function spin() {
                    ++root._spinCount;
                    while (root._waitingQueue.length)
                        (root._waitingQueue.shift())();
                    if (root._waitingFor)
                        store.get(-Infinity).onsuccess = spin;
                }());
            }
            var currentWaitPromise = root._waitingFor;
            return new DexiePromise(function (resolve, reject) {
                promise.then(function (res) { return root._waitingQueue.push(wrap(resolve.bind(null, res))); }, function (err) { return root._waitingQueue.push(wrap(reject.bind(null, err))); }).finally(function () {
                    if (root._waitingFor === currentWaitPromise) {
                        root._waitingFor = null;
                    }
                });
            });
        };
        Transaction.prototype.abort = function () {
            this.active && this._reject(new exceptions.Abort());
            this.active = false;
        };
        Transaction.prototype.table = function (tableName) {
            var memoizedTables = (this._memoizedTables || (this._memoizedTables = {}));
            if (hasOwn(memoizedTables, tableName))
                return memoizedTables[tableName];
            var tableSchema = this.schema[tableName];
            if (!tableSchema) {
                throw new exceptions.NotFound("Table " + tableName + " not part of transaction");
            }
            var transactionBoundTable = new this.db.Table(tableName, tableSchema, this);
            transactionBoundTable.core = this.db.core.table(tableName);
            memoizedTables[tableName] = transactionBoundTable;
            return transactionBoundTable;
        };
        return Transaction;
    }());

    function createTransactionConstructor(db) {
        return makeClassConstructor(Transaction.prototype, function Transaction$$1(mode, storeNames, dbschema, parent) {
            var _this = this;
            this.db = db;
            this.mode = mode;
            this.storeNames = storeNames;
            this.schema = dbschema;
            this.idbtrans = null;
            this.on = Events(this, "complete", "error", "abort");
            this.parent = parent || null;
            this.active = true;
            this._reculock = 0;
            this._blockedFuncs = [];
            this._resolve = null;
            this._reject = null;
            this._waitingFor = null;
            this._waitingQueue = null;
            this._spinCount = 0;
            this._completion = new DexiePromise(function (resolve, reject) {
                _this._resolve = resolve;
                _this._reject = reject;
            });
            this._completion.then(function () {
                _this.active = false;
                _this.on.complete.fire();
            }, function (e) {
                var wasActive = _this.active;
                _this.active = false;
                _this.on.error.fire(e);
                _this.parent ?
                    _this.parent._reject(e) :
                    wasActive && _this.idbtrans && _this.idbtrans.abort();
                return rejection(e);
            });
        });
    }

    function createIndexSpec(name, keyPath, unique, multi, auto, compound, isPrimKey) {
        return {
            name: name,
            keyPath: keyPath,
            unique: unique,
            multi: multi,
            auto: auto,
            compound: compound,
            src: (unique && !isPrimKey ? '&' : '') + (multi ? '*' : '') + (auto ? "++" : "") + nameFromKeyPath(keyPath)
        };
    }
    function nameFromKeyPath(keyPath) {
        return typeof keyPath === 'string' ?
            keyPath :
            keyPath ? ('[' + [].join.call(keyPath, '+') + ']') : "";
    }

    function createTableSchema(name, primKey, indexes) {
        return {
            name: name,
            primKey: primKey,
            indexes: indexes,
            mappedClass: null,
            idxByName: arrayToObject(indexes, function (index) { return [index.name, index]; })
        };
    }

    function getKeyExtractor(keyPath) {
        if (keyPath == null) {
            return function () { return undefined; };
        }
        else if (typeof keyPath === 'string') {
            return getSinglePathKeyExtractor(keyPath);
        }
        else {
            return function (obj) { return getByKeyPath(obj, keyPath); };
        }
    }
    function getSinglePathKeyExtractor(keyPath) {
        var split = keyPath.split('.');
        if (split.length === 1) {
            return function (obj) { return obj[keyPath]; };
        }
        else {
            return function (obj) { return getByKeyPath(obj, keyPath); };
        }
    }

    function getEffectiveKeys(primaryKey, req) {
        if (req.type === 'delete')
            return req.keys;
        return req.keys || req.values.map(primaryKey.extractKey);
    }
    function getExistingValues(table, req, effectiveKeys) {
        return req.type === 'add' ? Promise.resolve(new Array(req.values.length)) :
            table.getMany({ trans: req.trans, keys: effectiveKeys });
    }

    function arrayify(arrayLike) {
        return [].slice.call(arrayLike);
    }

    var _id_counter = 0;
    function getKeyPathAlias(keyPath) {
        return keyPath == null ?
            ":id" :
            typeof keyPath === 'string' ?
                keyPath :
                "[" + keyPath.join('+') + "]";
    }
    function createDBCore(db, indexedDB, IdbKeyRange, tmpTrans) {
        var cmp = indexedDB.cmp.bind(indexedDB);
        function extractSchema(db, trans) {
            var tables = arrayify(db.objectStoreNames);
            return {
                schema: {
                    name: db.name,
                    tables: tables.map(function (table) { return trans.objectStore(table); }).map(function (store) {
                        var keyPath = store.keyPath, autoIncrement = store.autoIncrement;
                        var compound = isArray(keyPath);
                        var outbound = keyPath == null;
                        var indexByKeyPath = {};
                        var result = {
                            name: store.name,
                            primaryKey: {
                                name: null,
                                isPrimaryKey: true,
                                outbound: outbound,
                                compound: compound,
                                keyPath: keyPath,
                                autoIncrement: autoIncrement,
                                unique: true,
                                extractKey: getKeyExtractor(keyPath)
                            },
                            indexes: arrayify(store.indexNames).map(function (indexName) { return store.index(indexName); })
                                .map(function (index) {
                                var name = index.name, unique = index.unique, multiEntry = index.multiEntry, keyPath = index.keyPath;
                                var compound = isArray(keyPath);
                                var result = {
                                    name: name,
                                    compound: compound,
                                    keyPath: keyPath,
                                    unique: unique,
                                    multiEntry: multiEntry,
                                    extractKey: getKeyExtractor(keyPath)
                                };
                                indexByKeyPath[getKeyPathAlias(keyPath)] = result;
                                return result;
                            }),
                            getIndexByKeyPath: function (keyPath) { return indexByKeyPath[getKeyPathAlias(keyPath)]; }
                        };
                        indexByKeyPath[":id"] = result.primaryKey;
                        if (keyPath != null) {
                            indexByKeyPath[getKeyPathAlias(keyPath)] = result.primaryKey;
                        }
                        return result;
                    })
                },
                hasGetAll: tables.length > 0 && ('getAll' in trans.objectStore(tables[0])) &&
                    !(typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) &&
                        !/(Chrome\/|Edge\/)/.test(navigator.userAgent) &&
                        [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604)
            };
        }
        function makeIDBKeyRange(range) {
            if (range.type === 3          )
                return null;
            if (range.type === 4            )
                throw new Error("Cannot convert never type to IDBKeyRange");
            var lower = range.lower, upper = range.upper, lowerOpen = range.lowerOpen, upperOpen = range.upperOpen;
            var idbRange = lower === undefined ?
                upper === undefined ?
                    null :
                    IdbKeyRange.upperBound(upper, !!upperOpen) :
                upper === undefined ?
                    IdbKeyRange.lowerBound(lower, !!lowerOpen) :
                    IdbKeyRange.bound(lower, upper, !!lowerOpen, !!upperOpen);
            return idbRange;
        }
        function createDbCoreTable(tableSchema) {
            var tableName = tableSchema.name;
            function mutate(_a) {
                var trans = _a.trans, type = _a.type, keys$$1 = _a.keys, values = _a.values, range = _a.range, wantResults = _a.wantResults;
                return new Promise(function (resolve, reject) {
                    resolve = wrap(resolve);
                    var store = trans.objectStore(tableName);
                    var outbound = store.keyPath == null;
                    var isAddOrPut = type === "put" || type === "add";
                    if (!isAddOrPut && type !== 'delete' && type !== 'deleteRange')
                        throw new Error("Invalid operation type: " + type);
                    var length = (keys$$1 || values || { length: 1 }).length;
                    if (keys$$1 && values && keys$$1.length !== values.length) {
                        throw new Error("Given keys array must have same length as given values array.");
                    }
                    if (length === 0)
                        return resolve({ numFailures: 0, failures: {}, results: [], lastResult: undefined });
                    var results = wantResults && __spreadArrays((keys$$1 ?
                        keys$$1 :
                        getEffectiveKeys(tableSchema.primaryKey, { type: type, keys: keys$$1, values: values })));
                    var req;
                    var failures = [];
                    var numFailures = 0;
                    var errorHandler = function (event) {
                        ++numFailures;
                        preventDefault(event);
                        if (results)
                            results[event.target._reqno] = undefined;
                        failures[event.target._reqno] = event.target.error;
                    };
                    var setResult = function (_a) {
                        var target = _a.target;
                        results[target._reqno] = target.result;
                    };
                    if (type === 'deleteRange') {
                        if (range.type === 4            )
                            return resolve({ numFailures: numFailures, failures: failures, results: results, lastResult: undefined });
                        if (range.type === 3          )
                            req = store.clear();
                        else
                            req = store.delete(makeIDBKeyRange(range));
                    }
                    else {
                        var _a = isAddOrPut ?
                            outbound ?
                                [values, keys$$1] :
                                [values, null] :
                            [keys$$1, null], args1 = _a[0], args2 = _a[1];
                        if (isAddOrPut) {
                            for (var i = 0; i < length; ++i) {
                                req = (args2 && args2[i] !== undefined ?
                                    store[type](args1[i], args2[i]) :
                                    store[type](args1[i]));
                                req._reqno = i;
                                if (results && results[i] === undefined) {
                                    req.onsuccess = setResult;
                                }
                                req.onerror = errorHandler;
                            }
                        }
                        else {
                            for (var i = 0; i < length; ++i) {
                                req = store[type](args1[i]);
                                req._reqno = i;
                                req.onerror = errorHandler;
                            }
                        }
                    }
                    var done = function (event) {
                        var lastResult = event.target.result;
                        if (results)
                            results[length - 1] = lastResult;
                        resolve({
                            numFailures: numFailures,
                            failures: failures,
                            results: results,
                            lastResult: lastResult
                        });
                    };
                    req.onerror = function (event) {
                        errorHandler(event);
                        done(event);
                    };
                    req.onsuccess = done;
                });
            }
            function openCursor(_a) {
                var trans = _a.trans, values = _a.values, query = _a.query, reverse = _a.reverse, unique = _a.unique;
                return new Promise(function (resolve, reject) {
                    resolve = wrap(resolve);
                    var index = query.index, range = query.range;
                    var store = trans.objectStore(tableName);
                    var source = index.isPrimaryKey ?
                        store :
                        store.index(index.name);
                    var direction = reverse ?
                        unique ?
                            "prevunique" :
                            "prev" :
                        unique ?
                            "nextunique" :
                            "next";
                    var req = values || !('openKeyCursor' in source) ?
                        source.openCursor(makeIDBKeyRange(range), direction) :
                        source.openKeyCursor(makeIDBKeyRange(range), direction);
                    req.onerror = eventRejectHandler(reject);
                    req.onsuccess = wrap(function (ev) {
                        var cursor = req.result;
                        if (!cursor) {
                            resolve(null);
                            return;
                        }
                        cursor.___id = ++_id_counter;
                        cursor.done = false;
                        var _cursorContinue = cursor.continue.bind(cursor);
                        var _cursorContinuePrimaryKey = cursor.continuePrimaryKey;
                        if (_cursorContinuePrimaryKey)
                            _cursorContinuePrimaryKey = _cursorContinuePrimaryKey.bind(cursor);
                        var _cursorAdvance = cursor.advance.bind(cursor);
                        var doThrowCursorIsNotStarted = function () { throw new Error("Cursor not started"); };
                        var doThrowCursorIsStopped = function () { throw new Error("Cursor not stopped"); };
                        cursor.trans = trans;
                        cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsNotStarted;
                        cursor.fail = wrap(reject);
                        cursor.next = function () {
                            var _this = this;
                            var gotOne = 1;
                            return this.start(function () { return gotOne-- ? _this.continue() : _this.stop(); }).then(function () { return _this; });
                        };
                        cursor.start = function (callback) {
                            var iterationPromise = new Promise(function (resolveIteration, rejectIteration) {
                                resolveIteration = wrap(resolveIteration);
                                req.onerror = eventRejectHandler(rejectIteration);
                                cursor.fail = rejectIteration;
                                cursor.stop = function (value) {
                                    cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsStopped;
                                    resolveIteration(value);
                                };
                            });
                            var guardedCallback = function () {
                                if (req.result) {
                                    try {
                                        callback();
                                    }
                                    catch (err) {
                                        cursor.fail(err);
                                    }
                                }
                                else {
                                    cursor.done = true;
                                    cursor.start = function () { throw new Error("Cursor behind last entry"); };
                                    cursor.stop();
                                }
                            };
                            req.onsuccess = wrap(function (ev) {
                                req.onsuccess = guardedCallback;
                                guardedCallback();
                            });
                            cursor.continue = _cursorContinue;
                            cursor.continuePrimaryKey = _cursorContinuePrimaryKey;
                            cursor.advance = _cursorAdvance;
                            guardedCallback();
                            return iterationPromise;
                        };
                        resolve(cursor);
                    }, reject);
                });
            }
            function query(hasGetAll) {
                return function (request) {
                    return new Promise(function (resolve, reject) {
                        resolve = wrap(resolve);
                        var trans = request.trans, values = request.values, limit = request.limit, query = request.query;
                        var nonInfinitLimit = limit === Infinity ? undefined : limit;
                        var index = query.index, range = query.range;
                        var store = trans.objectStore(tableName);
                        var source = index.isPrimaryKey ? store : store.index(index.name);
                        var idbKeyRange = makeIDBKeyRange(range);
                        if (limit === 0)
                            return resolve({ result: [] });
                        if (hasGetAll) {
                            var req = values ?
                                source.getAll(idbKeyRange, nonInfinitLimit) :
                                source.getAllKeys(idbKeyRange, nonInfinitLimit);
                            req.onsuccess = function (event) { return resolve({ result: event.target.result }); };
                            req.onerror = eventRejectHandler(reject);
                        }
                        else {
                            var count_1 = 0;
                            var req_1 = values || !('openKeyCursor' in source) ?
                                source.openCursor(idbKeyRange) :
                                source.openKeyCursor(idbKeyRange);
                            var result_1 = [];
                            req_1.onsuccess = function (event) {
                                var cursor = req_1.result;
                                if (!cursor)
                                    return resolve({ result: result_1 });
                                result_1.push(values ? cursor.value : cursor.primaryKey);
                                if (++count_1 === limit)
                                    return resolve({ result: result_1 });
                                cursor.continue();
                            };
                            req_1.onerror = eventRejectHandler(reject);
                        }
                    });
                };
            }
            return {
                name: tableName,
                schema: tableSchema,
                mutate: mutate,
                getMany: function (_a) {
                    var trans = _a.trans, keys$$1 = _a.keys;
                    return new Promise(function (resolve, reject) {
                        resolve = wrap(resolve);
                        var store = trans.objectStore(tableName);
                        var length = keys$$1.length;
                        var result = new Array(length);
                        var keyCount = 0;
                        var callbackCount = 0;
                        var req;
                        var successHandler = function (event) {
                            var req = event.target;
                            if ((result[req._pos] = req.result) != null)
                                ;
                            if (++callbackCount === keyCount)
                                resolve(result);
                        };
                        var errorHandler = eventRejectHandler(reject);
                        for (var i = 0; i < length; ++i) {
                            var key = keys$$1[i];
                            if (key != null) {
                                req = store.get(keys$$1[i]);
                                req._pos = i;
                                req.onsuccess = successHandler;
                                req.onerror = errorHandler;
                                ++keyCount;
                            }
                        }
                        if (keyCount === 0)
                            resolve(result);
                    });
                },
                get: function (_a) {
                    var trans = _a.trans, key = _a.key;
                    return new Promise(function (resolve, reject) {
                        resolve = wrap(resolve);
                        var store = trans.objectStore(tableName);
                        var req = store.get(key);
                        req.onsuccess = function (event) { return resolve(event.target.result); };
                        req.onerror = eventRejectHandler(reject);
                    });
                },
                query: query(hasGetAll),
                openCursor: openCursor,
                count: function (_a) {
                    var query = _a.query, trans = _a.trans;
                    var index = query.index, range = query.range;
                    return new Promise(function (resolve, reject) {
                        var store = trans.objectStore(tableName);
                        var source = index.isPrimaryKey ? store : store.index(index.name);
                        var idbKeyRange = makeIDBKeyRange(range);
                        var req = idbKeyRange ? source.count(idbKeyRange) : source.count();
                        req.onsuccess = wrap(function (ev) { return resolve(ev.target.result); });
                        req.onerror = eventRejectHandler(reject);
                    });
                }
            };
        }
        var _a = extractSchema(db, tmpTrans), schema = _a.schema, hasGetAll = _a.hasGetAll;
        var tables = schema.tables.map(function (tableSchema) { return createDbCoreTable(tableSchema); });
        var tableMap = {};
        tables.forEach(function (table) { return tableMap[table.name] = table; });
        return {
            stack: "dbcore",
            transaction: db.transaction.bind(db),
            table: function (name) {
                var result = tableMap[name];
                if (!result)
                    throw new Error("Table '" + name + "' not found");
                return tableMap[name];
            },
            cmp: cmp,
            MIN_KEY: -Infinity,
            MAX_KEY: getMaxKey(IdbKeyRange),
            schema: schema
        };
    }

    function createMiddlewareStack(stackImpl, middlewares) {
        return middlewares.reduce(function (down, _a) {
            var create = _a.create;
            return (__assign(__assign({}, down), create(down)));
        }, stackImpl);
    }
    function createMiddlewareStacks(middlewares, idbdb, _a, tmpTrans) {
        var IDBKeyRange = _a.IDBKeyRange, indexedDB = _a.indexedDB;
        var dbcore = createMiddlewareStack(createDBCore(idbdb, indexedDB, IDBKeyRange, tmpTrans), middlewares.dbcore);
        return {
            dbcore: dbcore
        };
    }
    function generateMiddlewareStacks(db, tmpTrans) {
        var idbdb = tmpTrans.db;
        var stacks = createMiddlewareStacks(db._middlewares, idbdb, db._deps, tmpTrans);
        db.core = stacks.dbcore;
        db.tables.forEach(function (table) {
            var tableName = table.name;
            if (db.core.schema.tables.some(function (tbl) { return tbl.name === tableName; })) {
                table.core = db.core.table(tableName);
                if (db[tableName] instanceof db.Table) {
                    db[tableName].core = table.core;
                }
            }
        });
    }

    function setApiOnPlace(db, objs, tableNames, dbschema) {
        tableNames.forEach(function (tableName) {
            var schema = dbschema[tableName];
            objs.forEach(function (obj) {
                if (!(tableName in obj)) {
                    if (obj === db.Transaction.prototype || obj instanceof db.Transaction) {
                        setProp(obj, tableName, {
                            get: function () { return this.table(tableName); },
                            set: function (value) {
                                defineProperty(this, tableName, { value: value, writable: true, configurable: true, enumerable: true });
                            }
                        });
                    }
                    else {
                        obj[tableName] = new db.Table(tableName, schema);
                    }
                }
            });
        });
    }
    function removeTablesApi(db, objs) {
        objs.forEach(function (obj) {
            for (var key in obj) {
                if (obj[key] instanceof db.Table)
                    delete obj[key];
            }
        });
    }
    function lowerVersionFirst(a, b) {
        return a._cfg.version - b._cfg.version;
    }
    function runUpgraders(db, oldVersion, idbUpgradeTrans, reject) {
        var globalSchema = db._dbSchema;
        var trans = db._createTransaction('readwrite', db._storeNames, globalSchema);
        trans.create(idbUpgradeTrans);
        trans._completion.catch(reject);
        var rejectTransaction = trans._reject.bind(trans);
        var transless = PSD.transless || PSD;
        newScope(function () {
            PSD.trans = trans;
            PSD.transless = transless;
            if (oldVersion === 0) {
                keys(globalSchema).forEach(function (tableName) {
                    createTable(idbUpgradeTrans, tableName, globalSchema[tableName].primKey, globalSchema[tableName].indexes);
                });
                generateMiddlewareStacks(db, idbUpgradeTrans);
                DexiePromise.follow(function () { return db.on.populate.fire(trans); }).catch(rejectTransaction);
            }
            else
                updateTablesAndIndexes(db, oldVersion, trans, idbUpgradeTrans).catch(rejectTransaction);
        });
    }
    function updateTablesAndIndexes(db, oldVersion, trans, idbUpgradeTrans) {
        var queue = [];
        var versions = db._versions;
        var globalSchema = db._dbSchema = buildGlobalSchema(db, db.idbdb, idbUpgradeTrans);
        var anyContentUpgraderHasRun = false;
        var versToRun = versions.filter(function (v) { return v._cfg.version >= oldVersion; });
        versToRun.forEach(function (version) {
            queue.push(function () {
                var oldSchema = globalSchema;
                var newSchema = version._cfg.dbschema;
                adjustToExistingIndexNames(db, oldSchema, idbUpgradeTrans);
                adjustToExistingIndexNames(db, newSchema, idbUpgradeTrans);
                globalSchema = db._dbSchema = newSchema;
                var diff = getSchemaDiff(oldSchema, newSchema);
                diff.add.forEach(function (tuple) {
                    createTable(idbUpgradeTrans, tuple[0], tuple[1].primKey, tuple[1].indexes);
                });
                diff.change.forEach(function (change) {
                    if (change.recreate) {
                        throw new exceptions.Upgrade("Not yet support for changing primary key");
                    }
                    else {
                        var store_1 = idbUpgradeTrans.objectStore(change.name);
                        change.add.forEach(function (idx) { return addIndex(store_1, idx); });
                        change.change.forEach(function (idx) {
                            store_1.deleteIndex(idx.name);
                            addIndex(store_1, idx);
                        });
                        change.del.forEach(function (idxName) { return store_1.deleteIndex(idxName); });
                    }
                });
                var contentUpgrade = version._cfg.contentUpgrade;
                if (contentUpgrade && version._cfg.version > oldVersion) {
                    generateMiddlewareStacks(db, idbUpgradeTrans);
                    anyContentUpgraderHasRun = true;
                    var upgradeSchema_1 = shallowClone(newSchema);
                    diff.del.forEach(function (table) {
                        upgradeSchema_1[table] = oldSchema[table];
                    });
                    removeTablesApi(db, [db.Transaction.prototype]);
                    setApiOnPlace(db, [db.Transaction.prototype], keys(upgradeSchema_1), upgradeSchema_1);
                    trans.schema = upgradeSchema_1;
                    var contentUpgradeIsAsync_1 = isAsyncFunction(contentUpgrade);
                    if (contentUpgradeIsAsync_1) {
                        incrementExpectedAwaits();
                    }
                    var returnValue_1;
                    var promiseFollowed = DexiePromise.follow(function () {
                        returnValue_1 = contentUpgrade(trans);
                        if (returnValue_1) {
                            if (contentUpgradeIsAsync_1) {
                                var decrementor = decrementExpectedAwaits.bind(null, null);
                                returnValue_1.then(decrementor, decrementor);
                            }
                        }
                    });
                    return (returnValue_1 && typeof returnValue_1.then === 'function' ?
                        DexiePromise.resolve(returnValue_1) : promiseFollowed.then(function () { return returnValue_1; }));
                }
            });
            queue.push(function (idbtrans) {
                if (!anyContentUpgraderHasRun || !hasIEDeleteObjectStoreBug) {
                    var newSchema = version._cfg.dbschema;
                    deleteRemovedTables(newSchema, idbtrans);
                }
                removeTablesApi(db, [db.Transaction.prototype]);
                setApiOnPlace(db, [db.Transaction.prototype], db._storeNames, db._dbSchema);
                trans.schema = db._dbSchema;
            });
        });
        function runQueue() {
            return queue.length ? DexiePromise.resolve(queue.shift()(trans.idbtrans)).then(runQueue) :
                DexiePromise.resolve();
        }
        return runQueue().then(function () {
            createMissingTables(globalSchema, idbUpgradeTrans);
        });
    }
    function getSchemaDiff(oldSchema, newSchema) {
        var diff = {
            del: [],
            add: [],
            change: []
        };
        var table;
        for (table in oldSchema) {
            if (!newSchema[table])
                diff.del.push(table);
        }
        for (table in newSchema) {
            var oldDef = oldSchema[table], newDef = newSchema[table];
            if (!oldDef) {
                diff.add.push([table, newDef]);
            }
            else {
                var change = {
                    name: table,
                    def: newDef,
                    recreate: false,
                    del: [],
                    add: [],
                    change: []
                };
                if (oldDef.primKey.src !== newDef.primKey.src &&
                    !isIEOrEdge
                ) {
                    change.recreate = true;
                    diff.change.push(change);
                }
                else {
                    var oldIndexes = oldDef.idxByName;
                    var newIndexes = newDef.idxByName;
                    var idxName = void 0;
                    for (idxName in oldIndexes) {
                        if (!newIndexes[idxName])
                            change.del.push(idxName);
                    }
                    for (idxName in newIndexes) {
                        var oldIdx = oldIndexes[idxName], newIdx = newIndexes[idxName];
                        if (!oldIdx)
                            change.add.push(newIdx);
                        else if (oldIdx.src !== newIdx.src)
                            change.change.push(newIdx);
                    }
                    if (change.del.length > 0 || change.add.length > 0 || change.change.length > 0) {
                        diff.change.push(change);
                    }
                }
            }
        }
        return diff;
    }
    function createTable(idbtrans, tableName, primKey, indexes) {
        var store = idbtrans.db.createObjectStore(tableName, primKey.keyPath ?
            { keyPath: primKey.keyPath, autoIncrement: primKey.auto } :
            { autoIncrement: primKey.auto });
        indexes.forEach(function (idx) { return addIndex(store, idx); });
        return store;
    }
    function createMissingTables(newSchema, idbtrans) {
        keys(newSchema).forEach(function (tableName) {
            if (!idbtrans.db.objectStoreNames.contains(tableName)) {
                createTable(idbtrans, tableName, newSchema[tableName].primKey, newSchema[tableName].indexes);
            }
        });
    }
    function deleteRemovedTables(newSchema, idbtrans) {
        for (var i = 0; i < idbtrans.db.objectStoreNames.length; ++i) {
            var storeName = idbtrans.db.objectStoreNames[i];
            if (newSchema[storeName] == null) {
                idbtrans.db.deleteObjectStore(storeName);
            }
        }
    }
    function addIndex(store, idx) {
        store.createIndex(idx.name, idx.keyPath, { unique: idx.unique, multiEntry: idx.multi });
    }
    function buildGlobalSchema(db, idbdb, tmpTrans) {
        var globalSchema = {};
        var dbStoreNames = slice(idbdb.objectStoreNames, 0);
        dbStoreNames.forEach(function (storeName) {
            var store = tmpTrans.objectStore(storeName);
            var keyPath = store.keyPath;
            var primKey = createIndexSpec(nameFromKeyPath(keyPath), keyPath || "", false, false, !!store.autoIncrement, keyPath && typeof keyPath !== "string", true);
            var indexes = [];
            for (var j = 0; j < store.indexNames.length; ++j) {
                var idbindex = store.index(store.indexNames[j]);
                keyPath = idbindex.keyPath;
                var index = createIndexSpec(idbindex.name, keyPath, !!idbindex.unique, !!idbindex.multiEntry, false, keyPath && typeof keyPath !== "string", false);
                indexes.push(index);
            }
            globalSchema[storeName] = createTableSchema(storeName, primKey, indexes);
        });
        return globalSchema;
    }
    function readGlobalSchema(db, idbdb, tmpTrans) {
        db.verno = idbdb.version / 10;
        var globalSchema = db._dbSchema = buildGlobalSchema(db, idbdb, tmpTrans);
        db._storeNames = slice(idbdb.objectStoreNames, 0);
        setApiOnPlace(db, [db._allTables], keys(globalSchema), globalSchema);
    }
    function adjustToExistingIndexNames(db, schema, idbtrans) {
        var storeNames = idbtrans.db.objectStoreNames;
        for (var i = 0; i < storeNames.length; ++i) {
            var storeName = storeNames[i];
            var store = idbtrans.objectStore(storeName);
            db._hasGetAll = 'getAll' in store;
            for (var j = 0; j < store.indexNames.length; ++j) {
                var indexName = store.indexNames[j];
                var keyPath = store.index(indexName).keyPath;
                var dexieName = typeof keyPath === 'string' ? keyPath : "[" + slice(keyPath).join('+') + "]";
                if (schema[storeName]) {
                    var indexSpec = schema[storeName].idxByName[dexieName];
                    if (indexSpec) {
                        indexSpec.name = indexName;
                        delete schema[storeName].idxByName[dexieName];
                        schema[storeName].idxByName[indexName] = indexSpec;
                    }
                }
            }
        }
        if (typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) &&
            !/(Chrome\/|Edge\/)/.test(navigator.userAgent) &&
            _global.WorkerGlobalScope && _global instanceof _global.WorkerGlobalScope &&
            [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604) {
            db._hasGetAll = false;
        }
    }
    function parseIndexSyntax(primKeyAndIndexes) {
        return primKeyAndIndexes.split(',').map(function (index, indexNum) {
            index = index.trim();
            var name = index.replace(/([&*]|\+\+)/g, "");
            var keyPath = /^\[/.test(name) ? name.match(/^\[(.*)\]$/)[1].split('+') : name;
            return createIndexSpec(name, keyPath || null, /\&/.test(index), /\*/.test(index), /\+\+/.test(index), isArray(keyPath), indexNum === 0);
        });
    }

    var Version =               (function () {
        function Version() {
        }
        Version.prototype._parseStoresSpec = function (stores, outSchema) {
            keys(stores).forEach(function (tableName) {
                if (stores[tableName] !== null) {
                    var indexes = parseIndexSyntax(stores[tableName]);
                    var primKey = indexes.shift();
                    if (primKey.multi)
                        throw new exceptions.Schema("Primary key cannot be multi-valued");
                    indexes.forEach(function (idx) {
                        if (idx.auto)
                            throw new exceptions.Schema("Only primary key can be marked as autoIncrement (++)");
                        if (!idx.keyPath)
                            throw new exceptions.Schema("Index must have a name and cannot be an empty string");
                    });
                    outSchema[tableName] = createTableSchema(tableName, primKey, indexes);
                }
            });
        };
        Version.prototype.stores = function (stores) {
            var db = this.db;
            this._cfg.storesSource = this._cfg.storesSource ?
                extend(this._cfg.storesSource, stores) :
                stores;
            var versions = db._versions;
            var storesSpec = {};
            var dbschema = {};
            versions.forEach(function (version) {
                extend(storesSpec, version._cfg.storesSource);
                dbschema = (version._cfg.dbschema = {});
                version._parseStoresSpec(storesSpec, dbschema);
            });
            db._dbSchema = dbschema;
            removeTablesApi(db, [db._allTables, db, db.Transaction.prototype]);
            setApiOnPlace(db, [db._allTables, db, db.Transaction.prototype, this._cfg.tables], keys(dbschema), dbschema);
            db._storeNames = keys(dbschema);
            return this;
        };
        Version.prototype.upgrade = function (upgradeFunction) {
            this._cfg.contentUpgrade = upgradeFunction;
            return this;
        };
        return Version;
    }());

    function createVersionConstructor(db) {
        return makeClassConstructor(Version.prototype, function Version$$1(versionNumber) {
            this.db = db;
            this._cfg = {
                version: versionNumber,
                storesSource: null,
                dbschema: {},
                tables: {},
                contentUpgrade: null
            };
        });
    }

    var databaseEnumerator;
    function DatabaseEnumerator(indexedDB) {
        var hasDatabasesNative = indexedDB && typeof indexedDB.databases === 'function';
        var dbNamesTable;
        if (!hasDatabasesNative) {
            var db = new Dexie(DBNAMES_DB, { addons: [] });
            db.version(1).stores({ dbnames: 'name' });
            dbNamesTable = db.table('dbnames');
        }
        return {
            getDatabaseNames: function () {
                return hasDatabasesNative
                    ?
                        DexiePromise.resolve(indexedDB.databases()).then(function (infos) { return infos
                            .map(function (info) { return info.name; })
                            .filter(function (name) { return name !== DBNAMES_DB; }); })
                    :
                        dbNamesTable.toCollection().primaryKeys();
            },
            add: function (name) {
                return !hasDatabasesNative && name !== DBNAMES_DB && dbNamesTable.put({ name: name }).catch(nop);
            },
            remove: function (name) {
                return !hasDatabasesNative && name !== DBNAMES_DB && dbNamesTable.delete(name).catch(nop);
            }
        };
    }
    function initDatabaseEnumerator(indexedDB) {
        try {
            databaseEnumerator = DatabaseEnumerator(indexedDB);
        }
        catch (e) { }
    }

    function vip(fn) {
        return newScope(function () {
            PSD.letThrough = true;
            return fn();
        });
    }

    function dexieOpen(db) {
        var state = db._state;
        var indexedDB = db._deps.indexedDB;
        if (state.isBeingOpened || db.idbdb)
            return state.dbReadyPromise.then(function () { return state.dbOpenError ?
                rejection(state.dbOpenError) :
                db; });
        debug && (state.openCanceller._stackHolder = getErrorWithStack());
        state.isBeingOpened = true;
        state.dbOpenError = null;
        state.openComplete = false;
        var resolveDbReady = state.dbReadyResolve,
        upgradeTransaction = null;
        return DexiePromise.race([state.openCanceller, new DexiePromise(function (resolve, reject) {
                if (!indexedDB)
                    throw new exceptions.MissingAPI("indexedDB API not found. If using IE10+, make sure to run your code on a server URL " +
                        "(not locally). If using old Safari versions, make sure to include indexedDB polyfill.");
                var dbName = db.name;
                var req = state.autoSchema ?
                    indexedDB.open(dbName) :
                    indexedDB.open(dbName, Math.round(db.verno * 10));
                if (!req)
                    throw new exceptions.MissingAPI("IndexedDB API not available");
                req.onerror = eventRejectHandler(reject);
                req.onblocked = wrap(db._fireOnBlocked);
                req.onupgradeneeded = wrap(function (e) {
                    upgradeTransaction = req.transaction;
                    if (state.autoSchema && !db._options.allowEmptyDB) {
                        req.onerror = preventDefault;
                        upgradeTransaction.abort();
                        req.result.close();
                        var delreq = indexedDB.deleteDatabase(dbName);
                        delreq.onsuccess = delreq.onerror = wrap(function () {
                            reject(new exceptions.NoSuchDatabase("Database " + dbName + " doesnt exist"));
                        });
                    }
                    else {
                        upgradeTransaction.onerror = eventRejectHandler(reject);
                        var oldVer = e.oldVersion > Math.pow(2, 62) ? 0 : e.oldVersion;
                        db.idbdb = req.result;
                        runUpgraders(db, oldVer / 10, upgradeTransaction, reject);
                    }
                }, reject);
                req.onsuccess = wrap(function () {
                    upgradeTransaction = null;
                    var idbdb = db.idbdb = req.result;
                    var objectStoreNames = slice(idbdb.objectStoreNames);
                    if (objectStoreNames.length > 0)
                        try {
                            var tmpTrans = idbdb.transaction(safariMultiStoreFix(objectStoreNames), 'readonly');
                            if (state.autoSchema)
                                readGlobalSchema(db, idbdb, tmpTrans);
                            else
                                adjustToExistingIndexNames(db, db._dbSchema, tmpTrans);
                            generateMiddlewareStacks(db, tmpTrans);
                        }
                        catch (e) {
                        }
                    connections.push(db);
                    idbdb.onversionchange = wrap(function (ev) {
                        state.vcFired = true;
                        db.on("versionchange").fire(ev);
                    });
                    databaseEnumerator.add(dbName);
                    resolve();
                }, reject);
            })]).then(function () {
            state.onReadyBeingFired = [];
            return DexiePromise.resolve(vip(db.on.ready.fire)).then(function fireRemainders() {
                if (state.onReadyBeingFired.length > 0) {
                    var remainders = state.onReadyBeingFired.reduce(promisableChain, nop);
                    state.onReadyBeingFired = [];
                    return DexiePromise.resolve(vip(remainders)).then(fireRemainders);
                }
            });
        }).finally(function () {
            state.onReadyBeingFired = null;
        }).then(function () {
            state.isBeingOpened = false;
            return db;
        }).catch(function (err) {
            try {
                upgradeTransaction && upgradeTransaction.abort();
            }
            catch (e) { }
            state.isBeingOpened = false;
            db.close();
            state.dbOpenError = err;
            return rejection(state.dbOpenError);
        }).finally(function () {
            state.openComplete = true;
            resolveDbReady();
        });
    }

    function awaitIterator(iterator) {
        var callNext = function (result) { return iterator.next(result); }, doThrow = function (error) { return iterator.throw(error); }, onSuccess = step(callNext), onError = step(doThrow);
        function step(getNext) {
            return function (val) {
                var next = getNext(val), value = next.value;
                return next.done ? value :
                    (!value || typeof value.then !== 'function' ?
                        isArray(value) ? Promise.all(value).then(onSuccess, onError) : onSuccess(value) :
                        value.then(onSuccess, onError));
            };
        }
        return step(callNext)();
    }

    function extractTransactionArgs(mode, _tableArgs_, scopeFunc) {
        var i = arguments.length;
        if (i < 2)
            throw new exceptions.InvalidArgument("Too few arguments");
        var args = new Array(i - 1);
        while (--i)
            args[i - 1] = arguments[i];
        scopeFunc = args.pop();
        var tables = flatten(args);
        return [mode, tables, scopeFunc];
    }
    function enterTransactionScope(db, mode, storeNames, parentTransaction, scopeFunc) {
        return DexiePromise.resolve().then(function () {
            var transless = PSD.transless || PSD;
            var trans = db._createTransaction(mode, storeNames, db._dbSchema, parentTransaction);
            var zoneProps = {
                trans: trans,
                transless: transless
            };
            if (parentTransaction) {
                trans.idbtrans = parentTransaction.idbtrans;
            }
            else {
                trans.create();
            }
            var scopeFuncIsAsync = isAsyncFunction(scopeFunc);
            if (scopeFuncIsAsync) {
                incrementExpectedAwaits();
            }
            var returnValue;
            var promiseFollowed = DexiePromise.follow(function () {
                returnValue = scopeFunc.call(trans, trans);
                if (returnValue) {
                    if (scopeFuncIsAsync) {
                        var decrementor = decrementExpectedAwaits.bind(null, null);
                        returnValue.then(decrementor, decrementor);
                    }
                    else if (typeof returnValue.next === 'function' && typeof returnValue.throw === 'function') {
                        returnValue = awaitIterator(returnValue);
                    }
                }
            }, zoneProps);
            return (returnValue && typeof returnValue.then === 'function' ?
                DexiePromise.resolve(returnValue).then(function (x) { return trans.active ?
                    x
                    : rejection(new exceptions.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn")); })
                : promiseFollowed.then(function () { return returnValue; })).then(function (x) {
                if (parentTransaction)
                    trans._resolve();
                return trans._completion.then(function () { return x; });
            }).catch(function (e) {
                trans._reject(e);
                return rejection(e);
            });
        });
    }

    function pad(a, value, count) {
        var result = isArray(a) ? a.slice() : [a];
        for (var i = 0; i < count; ++i)
            result.push(value);
        return result;
    }
    function createVirtualIndexMiddleware(down) {
        return __assign(__assign({}, down), { table: function (tableName) {
                var table = down.table(tableName);
                var schema = table.schema;
                var indexLookup = {};
                var allVirtualIndexes = [];
                function addVirtualIndexes(keyPath, keyTail, lowLevelIndex) {
                    var keyPathAlias = getKeyPathAlias(keyPath);
                    var indexList = (indexLookup[keyPathAlias] = indexLookup[keyPathAlias] || []);
                    var keyLength = keyPath == null ? 0 : typeof keyPath === 'string' ? 1 : keyPath.length;
                    var isVirtual = keyTail > 0;
                    var virtualIndex = __assign(__assign({}, lowLevelIndex), { isVirtual: isVirtual, isPrimaryKey: !isVirtual && lowLevelIndex.isPrimaryKey, keyTail: keyTail,
                        keyLength: keyLength, extractKey: getKeyExtractor(keyPath), unique: !isVirtual && lowLevelIndex.unique });
                    indexList.push(virtualIndex);
                    if (!virtualIndex.isPrimaryKey) {
                        allVirtualIndexes.push(virtualIndex);
                    }
                    if (keyLength > 1) {
                        var virtualKeyPath = keyLength === 2 ?
                            keyPath[0] :
                            keyPath.slice(0, keyLength - 1);
                        addVirtualIndexes(virtualKeyPath, keyTail + 1, lowLevelIndex);
                    }
                    indexList.sort(function (a, b) { return a.keyTail - b.keyTail; });
                    return virtualIndex;
                }
                var primaryKey = addVirtualIndexes(schema.primaryKey.keyPath, 0, schema.primaryKey);
                indexLookup[":id"] = [primaryKey];
                for (var _i = 0, _a = schema.indexes; _i < _a.length; _i++) {
                    var index = _a[_i];
                    addVirtualIndexes(index.keyPath, 0, index);
                }
                function findBestIndex(keyPath) {
                    var result = indexLookup[getKeyPathAlias(keyPath)];
                    return result && result[0];
                }
                function translateRange(range, keyTail) {
                    return {
                        type: range.type === 1             ?
                            2             :
                            range.type,
                        lower: pad(range.lower, range.lowerOpen ? down.MAX_KEY : down.MIN_KEY, keyTail),
                        lowerOpen: true,
                        upper: pad(range.upper, range.upperOpen ? down.MIN_KEY : down.MAX_KEY, keyTail),
                        upperOpen: true
                    };
                }
                function translateRequest(req) {
                    var index = req.query.index;
                    return index.isVirtual ? __assign(__assign({}, req), { query: {
                            index: index,
                            range: translateRange(req.query.range, index.keyTail)
                        } }) : req;
                }
                var result = __assign(__assign({}, table), { schema: __assign(__assign({}, schema), { primaryKey: primaryKey, indexes: allVirtualIndexes, getIndexByKeyPath: findBestIndex }), count: function (req) {
                        return table.count(translateRequest(req));
                    },
                    query: function (req) {
                        return table.query(translateRequest(req));
                    },
                    openCursor: function (req) {
                        var _a = req.query.index, keyTail = _a.keyTail, isVirtual = _a.isVirtual, keyLength = _a.keyLength;
                        if (!isVirtual)
                            return table.openCursor(req);
                        function createVirtualCursor(cursor) {
                            function _continue(key) {
                                key != null ?
                                    cursor.continue(pad(key, req.reverse ? down.MAX_KEY : down.MIN_KEY, keyTail)) :
                                    req.unique ?
                                        cursor.continue(pad(cursor.key, req.reverse ? down.MIN_KEY : down.MAX_KEY, keyTail)) :
                                        cursor.continue();
                            }
                            var virtualCursor = Object.create(cursor, {
                                continue: { value: _continue },
                                continuePrimaryKey: {
                                    value: function (key, primaryKey) {
                                        cursor.continuePrimaryKey(pad(key, down.MAX_KEY, keyTail), primaryKey);
                                    }
                                },
                                key: {
                                    get: function () {
                                        var key = cursor.key;
                                        return keyLength === 1 ?
                                            key[0] :
                                            key.slice(0, keyLength);
                                    }
                                },
                                value: {
                                    get: function () {
                                        return cursor.value;
                                    }
                                }
                            });
                            return virtualCursor;
                        }
                        return table.openCursor(translateRequest(req))
                            .then(function (cursor) { return cursor && createVirtualCursor(cursor); });
                    } });
                return result;
            } });
    }
    var virtualIndexMiddleware = {
        stack: "dbcore",
        name: "VirtualIndexMiddleware",
        level: 1,
        create: createVirtualIndexMiddleware
    };

    var hooksMiddleware = {
        stack: "dbcore",
        name: "HooksMiddleware",
        level: 2,
        create: function (downCore) { return (__assign(__assign({}, downCore), { table: function (tableName) {
                var downTable = downCore.table(tableName);
                var primaryKey = downTable.schema.primaryKey;
                var tableMiddleware = __assign(__assign({}, downTable), { mutate: function (req) {
                        var dxTrans = PSD.trans;
                        var _a = dxTrans.table(tableName).hook, deleting = _a.deleting, creating = _a.creating, updating = _a.updating;
                        switch (req.type) {
                            case 'add':
                                if (creating.fire === nop)
                                    break;
                                return dxTrans._promise('readwrite', function () { return addPutOrDelete(req); }, true);
                            case 'put':
                                if (creating.fire === nop && updating.fire === nop)
                                    break;
                                return dxTrans._promise('readwrite', function () { return addPutOrDelete(req); }, true);
                            case 'delete':
                                if (deleting.fire === nop)
                                    break;
                                return dxTrans._promise('readwrite', function () { return addPutOrDelete(req); }, true);
                            case 'deleteRange':
                                if (deleting.fire === nop)
                                    break;
                                return dxTrans._promise('readwrite', function () { return deleteRange(req); }, true);
                        }
                        return downTable.mutate(req);
                        function addPutOrDelete(req) {
                            var dxTrans = PSD.trans;
                            var keys$$1 = req.keys || getEffectiveKeys(primaryKey, req);
                            if (!keys$$1)
                                throw new Error("Keys missing");
                            req = req.type === 'add' || req.type === 'put' ? __assign(__assign({}, req), { keys: keys$$1, wantResults: true }) :
                             __assign({}, req);
                            if (req.type !== 'delete')
                                req.values = __spreadArrays(req.values);
                            if (req.keys)
                                req.keys = __spreadArrays(req.keys);
                            return getExistingValues(downTable, req, keys$$1).then(function (existingValues) {
                                var contexts = keys$$1.map(function (key, i) {
                                    var existingValue = existingValues[i];
                                    var ctx = { onerror: null, onsuccess: null };
                                    if (req.type === 'delete') {
                                        deleting.fire.call(ctx, key, existingValue, dxTrans);
                                    }
                                    else if (req.type === 'add' || existingValue === undefined) {
                                        var generatedPrimaryKey = creating.fire.call(ctx, key, req.values[i], dxTrans);
                                        if (key == null && generatedPrimaryKey != null) {
                                            key = generatedPrimaryKey;
                                            req.keys[i] = key;
                                            if (!primaryKey.outbound) {
                                                setByKeyPath(req.values[i], primaryKey.keyPath, key);
                                            }
                                        }
                                    }
                                    else {
                                        var objectDiff = getObjectDiff(existingValue, req.values[i]);
                                        var additionalChanges_1 = updating.fire.call(ctx, objectDiff, key, existingValue, dxTrans);
                                        if (additionalChanges_1) {
                                            var requestedValue_1 = req.values[i];
                                            Object.keys(additionalChanges_1).forEach(function (keyPath) {
                                                setByKeyPath(requestedValue_1, keyPath, additionalChanges_1[keyPath]);
                                            });
                                        }
                                    }
                                    return ctx;
                                });
                                return downTable.mutate(req).then(function (_a) {
                                    var failures = _a.failures, results = _a.results, numFailures = _a.numFailures, lastResult = _a.lastResult;
                                    for (var i = 0; i < keys$$1.length; ++i) {
                                        var primKey = results ? results[i] : keys$$1[i];
                                        var ctx = contexts[i];
                                        if (primKey == null) {
                                            ctx.onerror && ctx.onerror(failures[i]);
                                        }
                                        else {
                                            ctx.onsuccess && ctx.onsuccess(req.type === 'put' && existingValues[i] ?
                                                req.values[i] :
                                                primKey
                                            );
                                        }
                                    }
                                    return { failures: failures, results: results, numFailures: numFailures, lastResult: lastResult };
                                }).catch(function (error) {
                                    contexts.forEach(function (ctx) { return ctx.onerror && ctx.onerror(error); });
                                    return Promise.reject(error);
                                });
                            });
                        }
                        function deleteRange(req) {
                            return deleteNextChunk(req.trans, req.range, 10000);
                        }
                        function deleteNextChunk(trans, range, limit) {
                            return downTable.query({ trans: trans, values: false, query: { index: primaryKey, range: range }, limit: limit })
                                .then(function (_a) {
                                var result = _a.result;
                                return addPutOrDelete({ type: 'delete', keys: result, trans: trans }).then(function (res) {
                                    if (res.numFailures > 0)
                                        return Promise.reject(res.failures[0]);
                                    if (result.length < limit) {
                                        return { failures: [], numFailures: 0, lastResult: undefined };
                                    }
                                    else {
                                        return deleteNextChunk(trans, __assign(__assign({}, range), { lower: result[result.length - 1], lowerOpen: true }), limit);
                                    }
                                });
                            });
                        }
                    } });
                return tableMiddleware;
            } })); }
    };

    var Dexie =               (function () {
        function Dexie(name, options) {
            var _this = this;
            this._middlewares = {};
            this.verno = 0;
            var deps = Dexie.dependencies;
            this._options = options = __assign({
                addons: Dexie.addons, autoOpen: true,
                indexedDB: deps.indexedDB, IDBKeyRange: deps.IDBKeyRange }, options);
            this._deps = {
                indexedDB: options.indexedDB,
                IDBKeyRange: options.IDBKeyRange
            };
            var addons = options.addons;
            this._dbSchema = {};
            this._versions = [];
            this._storeNames = [];
            this._allTables = {};
            this.idbdb = null;
            var state = {
                dbOpenError: null,
                isBeingOpened: false,
                onReadyBeingFired: null,
                openComplete: false,
                dbReadyResolve: nop,
                dbReadyPromise: null,
                cancelOpen: nop,
                openCanceller: null,
                autoSchema: true
            };
            state.dbReadyPromise = new DexiePromise(function (resolve) {
                state.dbReadyResolve = resolve;
            });
            state.openCanceller = new DexiePromise(function (_, reject) {
                state.cancelOpen = reject;
            });
            this._state = state;
            this.name = name;
            this.on = Events(this, "populate", "blocked", "versionchange", { ready: [promisableChain, nop] });
            this.on.ready.subscribe = override(this.on.ready.subscribe, function (subscribe) {
                return function (subscriber, bSticky) {
                    Dexie.vip(function () {
                        var state = _this._state;
                        if (state.openComplete) {
                            if (!state.dbOpenError)
                                DexiePromise.resolve().then(subscriber);
                            if (bSticky)
                                subscribe(subscriber);
                        }
                        else if (state.onReadyBeingFired) {
                            state.onReadyBeingFired.push(subscriber);
                            if (bSticky)
                                subscribe(subscriber);
                        }
                        else {
                            subscribe(subscriber);
                            var db_1 = _this;
                            if (!bSticky)
                                subscribe(function unsubscribe() {
                                    db_1.on.ready.unsubscribe(subscriber);
                                    db_1.on.ready.unsubscribe(unsubscribe);
                                });
                        }
                    });
                };
            });
            this.Collection = createCollectionConstructor(this);
            this.Table = createTableConstructor(this);
            this.Transaction = createTransactionConstructor(this);
            this.Version = createVersionConstructor(this);
            this.WhereClause = createWhereClauseConstructor(this);
            this.on("versionchange", function (ev) {
                if (ev.newVersion > 0)
                    console.warn("Another connection wants to upgrade database '" + _this.name + "'. Closing db now to resume the upgrade.");
                else
                    console.warn("Another connection wants to delete database '" + _this.name + "'. Closing db now to resume the delete request.");
                _this.close();
            });
            this.on("blocked", function (ev) {
                if (!ev.newVersion || ev.newVersion < ev.oldVersion)
                    console.warn("Dexie.delete('" + _this.name + "') was blocked");
                else
                    console.warn("Upgrade '" + _this.name + "' blocked by other connection holding version " + ev.oldVersion / 10);
            });
            this._maxKey = getMaxKey(options.IDBKeyRange);
            this._createTransaction = function (mode, storeNames, dbschema, parentTransaction) { return new _this.Transaction(mode, storeNames, dbschema, parentTransaction); };
            this._fireOnBlocked = function (ev) {
                _this.on("blocked").fire(ev);
                connections
                    .filter(function (c) { return c.name === _this.name && c !== _this && !c._state.vcFired; })
                    .map(function (c) { return c.on("versionchange").fire(ev); });
            };
            this.use(virtualIndexMiddleware);
            this.use(hooksMiddleware);
            addons.forEach(function (addon) { return addon(_this); });
        }
        Dexie.prototype.version = function (versionNumber) {
            if (isNaN(versionNumber) || versionNumber < 0.1)
                throw new exceptions.Type("Given version is not a positive number");
            versionNumber = Math.round(versionNumber * 10) / 10;
            if (this.idbdb || this._state.isBeingOpened)
                throw new exceptions.Schema("Cannot add version when database is open");
            this.verno = Math.max(this.verno, versionNumber);
            var versions = this._versions;
            var versionInstance = versions.filter(function (v) { return v._cfg.version === versionNumber; })[0];
            if (versionInstance)
                return versionInstance;
            versionInstance = new this.Version(versionNumber);
            versions.push(versionInstance);
            versions.sort(lowerVersionFirst);
            versionInstance.stores({});
            this._state.autoSchema = false;
            return versionInstance;
        };
        Dexie.prototype._whenReady = function (fn) {
            var _this = this;
            return this._state.openComplete || PSD.letThrough ? fn() : new DexiePromise(function (resolve, reject) {
                if (!_this._state.isBeingOpened) {
                    if (!_this._options.autoOpen) {
                        reject(new exceptions.DatabaseClosed());
                        return;
                    }
                    _this.open().catch(nop);
                }
                _this._state.dbReadyPromise.then(resolve, reject);
            }).then(fn);
        };
        Dexie.prototype.use = function (_a) {
            var stack = _a.stack, create = _a.create, level = _a.level, name = _a.name;
            if (name)
                this.unuse({ stack: stack, name: name });
            var middlewares = this._middlewares[stack] || (this._middlewares[stack] = []);
            middlewares.push({ stack: stack, create: create, level: level == null ? 10 : level, name: name });
            middlewares.sort(function (a, b) { return a.level - b.level; });
            return this;
        };
        Dexie.prototype.unuse = function (_a) {
            var stack = _a.stack, name = _a.name, create = _a.create;
            if (stack && this._middlewares[stack]) {
                this._middlewares[stack] = this._middlewares[stack].filter(function (mw) {
                    return create ? mw.create !== create :
                        name ? mw.name !== name :
                            false;
                });
            }
            return this;
        };
        Dexie.prototype.open = function () {
            return dexieOpen(this);
        };
        Dexie.prototype.close = function () {
            var idx = connections.indexOf(this), state = this._state;
            if (idx >= 0)
                connections.splice(idx, 1);
            if (this.idbdb) {
                try {
                    this.idbdb.close();
                }
                catch (e) { }
                this.idbdb = null;
            }
            this._options.autoOpen = false;
            state.dbOpenError = new exceptions.DatabaseClosed();
            if (state.isBeingOpened)
                state.cancelOpen(state.dbOpenError);
            state.dbReadyPromise = new DexiePromise(function (resolve) {
                state.dbReadyResolve = resolve;
            });
            state.openCanceller = new DexiePromise(function (_, reject) {
                state.cancelOpen = reject;
            });
        };
        Dexie.prototype.delete = function () {
            var _this = this;
            var hasArguments = arguments.length > 0;
            var state = this._state;
            return new DexiePromise(function (resolve, reject) {
                var doDelete = function () {
                    _this.close();
                    var req = _this._deps.indexedDB.deleteDatabase(_this.name);
                    req.onsuccess = wrap(function () {
                        databaseEnumerator.remove(_this.name);
                        resolve();
                    });
                    req.onerror = eventRejectHandler(reject);
                    req.onblocked = _this._fireOnBlocked;
                };
                if (hasArguments)
                    throw new exceptions.InvalidArgument("Arguments not allowed in db.delete()");
                if (state.isBeingOpened) {
                    state.dbReadyPromise.then(doDelete);
                }
                else {
                    doDelete();
                }
            });
        };
        Dexie.prototype.backendDB = function () {
            return this.idbdb;
        };
        Dexie.prototype.isOpen = function () {
            return this.idbdb !== null;
        };
        Dexie.prototype.hasBeenClosed = function () {
            var dbOpenError = this._state.dbOpenError;
            return dbOpenError && (dbOpenError.name === 'DatabaseClosed');
        };
        Dexie.prototype.hasFailed = function () {
            return this._state.dbOpenError !== null;
        };
        Dexie.prototype.dynamicallyOpened = function () {
            return this._state.autoSchema;
        };
        Object.defineProperty(Dexie.prototype, "tables", {
            get: function () {
                var _this = this;
                return keys(this._allTables).map(function (name) { return _this._allTables[name]; });
            },
            enumerable: true,
            configurable: true
        });
        Dexie.prototype.transaction = function () {
            var args = extractTransactionArgs.apply(this, arguments);
            return this._transaction.apply(this, args);
        };
        Dexie.prototype._transaction = function (mode, tables, scopeFunc) {
            var _this = this;
            var parentTransaction = PSD.trans;
            if (!parentTransaction || parentTransaction.db !== this || mode.indexOf('!') !== -1)
                parentTransaction = null;
            var onlyIfCompatible = mode.indexOf('?') !== -1;
            mode = mode.replace('!', '').replace('?', '');
            var idbMode, storeNames;
            try {
                storeNames = tables.map(function (table) {
                    var storeName = table instanceof _this.Table ? table.name : table;
                    if (typeof storeName !== 'string')
                        throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");
                    return storeName;
                });
                if (mode == "r" || mode === READONLY)
                    idbMode = READONLY;
                else if (mode == "rw" || mode == READWRITE)
                    idbMode = READWRITE;
                else
                    throw new exceptions.InvalidArgument("Invalid transaction mode: " + mode);
                if (parentTransaction) {
                    if (parentTransaction.mode === READONLY && idbMode === READWRITE) {
                        if (onlyIfCompatible) {
                            parentTransaction = null;
                        }
                        else
                            throw new exceptions.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");
                    }
                    if (parentTransaction) {
                        storeNames.forEach(function (storeName) {
                            if (parentTransaction && parentTransaction.storeNames.indexOf(storeName) === -1) {
                                if (onlyIfCompatible) {
                                    parentTransaction = null;
                                }
                                else
                                    throw new exceptions.SubTransaction("Table " + storeName +
                                        " not included in parent transaction.");
                            }
                        });
                    }
                    if (onlyIfCompatible && parentTransaction && !parentTransaction.active) {
                        parentTransaction = null;
                    }
                }
            }
            catch (e) {
                return parentTransaction ?
                    parentTransaction._promise(null, function (_, reject) { reject(e); }) :
                    rejection(e);
            }
            var enterTransaction = enterTransactionScope.bind(null, this, idbMode, storeNames, parentTransaction, scopeFunc);
            return (parentTransaction ?
                parentTransaction._promise(idbMode, enterTransaction, "lock") :
                PSD.trans ?
                    usePSD(PSD.transless, function () { return _this._whenReady(enterTransaction); }) :
                    this._whenReady(enterTransaction));
        };
        Dexie.prototype.table = function (tableName) {
            if (!hasOwn(this._allTables, tableName)) {
                throw new exceptions.InvalidTable("Table " + tableName + " does not exist");
            }
            return this._allTables[tableName];
        };
        return Dexie;
    }());

    var Dexie$1 = Dexie;
    props(Dexie$1, __assign(__assign({}, fullNameExceptions), {
        delete: function (databaseName) {
            var db = new Dexie$1(databaseName);
            return db.delete();
        },
        exists: function (name) {
            return new Dexie$1(name, { addons: [] }).open().then(function (db) {
                db.close();
                return true;
            }).catch('NoSuchDatabaseError', function () { return false; });
        },
        getDatabaseNames: function (cb) {
            return databaseEnumerator ?
                databaseEnumerator.getDatabaseNames().then(cb) :
                DexiePromise.resolve([]);
        },
        defineClass: function () {
            function Class(content) {
                extend(this, content);
            }
            return Class;
        },
        ignoreTransaction: function (scopeFunc) {
            return PSD.trans ?
                usePSD(PSD.transless, scopeFunc) :
                scopeFunc();
        },
        vip: vip, async: function (generatorFn) {
            return function () {
                try {
                    var rv = awaitIterator(generatorFn.apply(this, arguments));
                    if (!rv || typeof rv.then !== 'function')
                        return DexiePromise.resolve(rv);
                    return rv;
                }
                catch (e) {
                    return rejection(e);
                }
            };
        }, spawn: function (generatorFn, args, thiz) {
            try {
                var rv = awaitIterator(generatorFn.apply(thiz, args || []));
                if (!rv || typeof rv.then !== 'function')
                    return DexiePromise.resolve(rv);
                return rv;
            }
            catch (e) {
                return rejection(e);
            }
        },
        currentTransaction: {
            get: function () { return PSD.trans || null; }
        }, waitFor: function (promiseOrFunction, optionalTimeout) {
            var promise = DexiePromise.resolve(typeof promiseOrFunction === 'function' ?
                Dexie$1.ignoreTransaction(promiseOrFunction) :
                promiseOrFunction)
                .timeout(optionalTimeout || 60000);
            return PSD.trans ?
                PSD.trans.waitFor(promise) :
                promise;
        },
        Promise: DexiePromise,
        debug: {
            get: function () { return debug; },
            set: function (value) {
                setDebug(value, value === 'dexie' ? function () { return true; } : dexieStackFrameFilter);
            }
        },
        derive: derive, extend: extend, props: props, override: override,
        Events: Events,
        getByKeyPath: getByKeyPath, setByKeyPath: setByKeyPath, delByKeyPath: delByKeyPath, shallowClone: shallowClone, deepClone: deepClone, getObjectDiff: getObjectDiff, asap: asap,
        minKey: minKey,
        addons: [],
        connections: connections,
        errnames: errnames,
        dependencies: (function () {
            try {
                return {
                    indexedDB: _global.indexedDB || _global.mozIndexedDB || _global.webkitIndexedDB || _global.msIndexedDB,
                    IDBKeyRange: _global.IDBKeyRange || _global.webkitIDBKeyRange
                };
            }
            catch (e) {
                return { indexedDB: null, IDBKeyRange: null };
            }
        })(),
        semVer: DEXIE_VERSION, version: DEXIE_VERSION.split('.')
            .map(function (n) { return parseInt(n); })
            .reduce(function (p, c, i) { return p + (c / Math.pow(10, i * 2)); }),
        default: Dexie$1,
        Dexie: Dexie$1 }));
    Dexie$1.maxKey = getMaxKey(Dexie$1.dependencies.IDBKeyRange);

    initDatabaseEnumerator(Dexie.dependencies.indexedDB);
    DexiePromise.rejectionMapper = mapError;
    setDebug(debug, dexieStackFrameFilter);

    function projectDB(project) {
      const db = new Dexie(`indie-tracker-${project.name}`);
      db.version(1).stores({
        issues: "id, title, status, created_at, updated_at",
      });
      db.version(2).stores({ configs: "id" });
      return db;
    }

    const ISSUE_STATUSES = {
      OPEN: "Open",
      PENDING: "Pending",
      DECLINED: "Declined",
      CLOSED: "Closed",
    };

    function format_date(date, time = true) {
      if (!date) return "-";
      let options = {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
      };

      if (time) {
        options = Object.assign(options, {
          hour12: false,
          hour: "numeric",
          minute: "2-digit",
        });
      }
      return new Intl.DateTimeFormat("default", options).format(date);
    }

    class Issue {
      get shorten_id() {
        return this.id.substring(0, 5);
      }
      get status_disp() {
        return ISSUE_STATUSES[this.status];
      }
      get createdDate() {
        return format_date(this.created_at, false);
      }
      get createdAt() {
        return format_date(this.created_at);
      }
      get updatedDate() {
        return format_date(this.updated_at, false);
      }
      get updatedAt() {
        return format_date(this.updated_at);
      }
    }

    /* src/pages/issue_list/index.svelte generated by Svelte v3.24.1 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (43:6) <Checkbox bind:group={$selectedStatuses} value={status}>
    function create_default_slot$1(ctx) {
    	let span;
    	let t0_value = ISSUE_STATUSES[/*status*/ ctx[10]] + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, t0);
    			insert(target, t1, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(span);
    			if (detaching) detach(t1);
    		}
    	};
    }

    // (42:6) {#each Object.keys(ISSUE_STATUSES) as status }
    function create_each_block_1(ctx) {
    	let checkbox;
    	let updating_group;
    	let current;

    	function checkbox_group_binding(value) {
    		/*checkbox_group_binding*/ ctx[3].call(null, value);
    	}

    	let checkbox_props = {
    		value: /*status*/ ctx[10],
    		$$slots: { default: [create_default_slot$1] },
    		$$scope: { ctx }
    	};

    	if (/*$selectedStatuses*/ ctx[1] !== void 0) {
    		checkbox_props.group = /*$selectedStatuses*/ ctx[1];
    	}

    	checkbox = new Ne({ props: checkbox_props });
    	binding_callbacks.push(() => bind(checkbox, "group", checkbox_group_binding));

    	return {
    		c() {
    			create_component(checkbox.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(checkbox, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const checkbox_changes = {};

    			if (dirty & /*$$scope*/ 8192) {
    				checkbox_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_group && dirty & /*$selectedStatuses*/ 2) {
    				updating_group = true;
    				checkbox_changes.group = /*$selectedStatuses*/ ctx[1];
    				add_flush_callback(() => updating_group = false);
    			}

    			checkbox.$set(checkbox_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(checkbox.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(checkbox.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(checkbox, detaching);
    		}
    	};
    }

    // (1:0) <script>   import { onMount }
    function create_catch_block(ctx) {
    	return { c: noop, m: noop, p: noop, d: noop };
    }

    // (58:39)      {#each issues as issue }
    function create_then_block(ctx) {
    	let each_1_anchor;
    	let each_value = /*issues*/ ctx[6];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*issuesPromise*/ 1) {
    				each_value = /*issues*/ ctx[6];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (59:4) {#each issues as issue }
    function create_each_block(ctx) {
    	let tr;
    	let td0;
    	let a0;
    	let t0_value = /*issue*/ ctx[7].shorten_id + "";
    	let t0;
    	let a0_href_value;
    	let link_action;
    	let t1;
    	let td1;
    	let a1;
    	let t2_value = /*issue*/ ctx[7].title + "";
    	let t2;
    	let a1_href_value;
    	let link_action_1;
    	let t3;
    	let td2;
    	let t4_value = /*issue*/ ctx[7].status_disp + "";
    	let t4;
    	let t5;
    	let td3;
    	let t6_value = /*issue*/ ctx[7].createdDate + "";
    	let t6;
    	let t7;
    	let td4;
    	let t8_value = /*issue*/ ctx[7].updatedDate + "";
    	let t8;
    	let t9;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			tr = element("tr");
    			td0 = element("td");
    			a0 = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			a1 = element("a");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			t4 = text(t4_value);
    			t5 = space();
    			td3 = element("td");
    			t6 = text(t6_value);
    			t7 = space();
    			td4 = element("td");
    			t8 = text(t8_value);
    			t9 = space();
    			attr(a0, "class", "issue-link svelte-1h337v4");
    			attr(a0, "href", a0_href_value = `/issues/${/*issue*/ ctx[7].id}`);
    			attr(td0, "class", "svelte-1h337v4");
    			attr(a1, "class", "issue-link svelte-1h337v4");
    			attr(a1, "href", a1_href_value = `/issues/${/*issue*/ ctx[7].id}`);
    			attr(td1, "class", "svelte-1h337v4");
    			attr(td2, "class", "prop prop-value svelte-1h337v4");
    			attr(td3, "class", "prop prop-value svelte-1h337v4");
    			attr(td4, "class", "prop prop-value svelte-1h337v4");
    		},
    		m(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td0);
    			append(td0, a0);
    			append(a0, t0);
    			append(tr, t1);
    			append(tr, td1);
    			append(td1, a1);
    			append(a1, t2);
    			append(tr, t3);
    			append(tr, td2);
    			append(td2, t4);
    			append(tr, t5);
    			append(tr, td3);
    			append(td3, t6);
    			append(tr, t7);
    			append(tr, td4);
    			append(td4, t8);
    			append(tr, t9);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(link_action = link.call(null, a0)),
    					action_destroyer(link_action_1 = link.call(null, a1))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*issuesPromise*/ 1 && t0_value !== (t0_value = /*issue*/ ctx[7].shorten_id + "")) set_data(t0, t0_value);

    			if (dirty & /*issuesPromise*/ 1 && a0_href_value !== (a0_href_value = `/issues/${/*issue*/ ctx[7].id}`)) {
    				attr(a0, "href", a0_href_value);
    			}

    			if (dirty & /*issuesPromise*/ 1 && t2_value !== (t2_value = /*issue*/ ctx[7].title + "")) set_data(t2, t2_value);

    			if (dirty & /*issuesPromise*/ 1 && a1_href_value !== (a1_href_value = `/issues/${/*issue*/ ctx[7].id}`)) {
    				attr(a1, "href", a1_href_value);
    			}

    			if (dirty & /*issuesPromise*/ 1 && t4_value !== (t4_value = /*issue*/ ctx[7].status_disp + "")) set_data(t4, t4_value);
    			if (dirty & /*issuesPromise*/ 1 && t6_value !== (t6_value = /*issue*/ ctx[7].createdDate + "")) set_data(t6, t6_value);
    			if (dirty & /*issuesPromise*/ 1 && t8_value !== (t8_value = /*issue*/ ctx[7].updatedDate + "")) set_data(t8, t8_value);
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (1:0) <script>   import { onMount }
    function create_pending_block(ctx) {
    	return { c: noop, m: noop, p: noop, d: noop };
    }

    function create_fragment$3(ctx) {
    	let div3;
    	let div0;
    	let h1;
    	let t1;
    	let addbutton;
    	let t2;
    	let fieldset;
    	let legend;
    	let t4;
    	let div2;
    	let div1;
    	let t6;
    	let t7;
    	let table;
    	let tr;
    	let t17;
    	let promise;
    	let current;
    	addbutton = new AddButton({});
    	addbutton.$on("click", /*click_handler*/ ctx[2]);
    	let each_value_1 = Object.keys(ISSUE_STATUSES);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 6
    	};

    	handle_promise(promise = /*issuesPromise*/ ctx[0], info);

    	return {
    		c() {
    			div3 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Issues";
    			t1 = space();
    			create_component(addbutton.$$.fragment);
    			t2 = space();
    			fieldset = element("fieldset");
    			legend = element("legend");
    			legend.textContent = "filters";
    			t4 = space();
    			div2 = element("div");
    			div1 = element("div");
    			div1.textContent = "Status:";
    			t6 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			table = element("table");
    			tr = element("tr");

    			tr.innerHTML = `<th style="width: 8%" class="svelte-1h337v4">id</th> 
      <th style="width: 47%" class="svelte-1h337v4">title</th> 
      <th style="width: 15%;" class="prop svelte-1h337v4">status</th> 
      <th style="width: 15%;" class="prop svelte-1h337v4">created at</th> 
      <th style="width: 15%;" class="prop svelte-1h337v4">updated at</th>`;

    			t17 = space();
    			info.block.c();
    			attr(div0, "class", "flex-align-top");
    			attr(div2, "class", "filter-status-row svelte-1h337v4");
    			attr(table, "class", "issue-table svelte-1h337v4");
    			attr(div3, "class", "issue-list card svelte-1h337v4");
    		},
    		m(target, anchor) {
    			insert(target, div3, anchor);
    			append(div3, div0);
    			append(div0, h1);
    			append(div0, t1);
    			mount_component(addbutton, div0, null);
    			append(div3, t2);
    			append(div3, fieldset);
    			append(fieldset, legend);
    			append(fieldset, t4);
    			append(fieldset, div2);
    			append(div2, div1);
    			append(div2, t6);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append(div3, t7);
    			append(div3, table);
    			append(table, tr);
    			append(table, t17);
    			info.block.m(table, info.anchor = null);
    			info.mount = () => table;
    			info.anchor = null;
    			current = true;
    		},
    		p(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (dirty & /*Object, ISSUE_STATUSES, $selectedStatuses*/ 2) {
    				each_value_1 = Object.keys(ISSUE_STATUSES);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div2, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			info.ctx = ctx;

    			if (dirty & /*issuesPromise*/ 1 && promise !== (promise = /*issuesPromise*/ ctx[0]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[6] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(addbutton.$$.fragment, local);

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			transition_out(addbutton.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div3);
    			destroy_component(addbutton);
    			destroy_each(each_blocks, detaching);
    			info.block.d();
    			info.token = null;
    			info = null;
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $project;
    	let $db;
    	let $selectedStatuses;
    	component_subscribe($$self, project, $$value => $$invalidate(4, $project = $$value));
    	component_subscribe($$self, db, $$value => $$invalidate(5, $db = $$value));
    	component_subscribe($$self, selectedStatuses, $$value => $$invalidate(1, $selectedStatuses = $$value));
    	let issuesPromise = Promise.resolve([]);
    	const click_handler = () => push("/issues/new");

    	function checkbox_group_binding(value) {
    		$selectedStatuses = value;
    		selectedStatuses.set($selectedStatuses);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$project*/ 16) {
    			 if ($project) {
    				window.document.title = `Issues @ ${$project.name} - Indie Tracker`;
    			}
    		}

    		if ($$self.$$.dirty & /*$db, $selectedStatuses*/ 34) {
    			 if ($db && $selectedStatuses) {
    				$db.issues.mapToClass(Issue);

    				$$invalidate(0, issuesPromise = $db.issues.where("status").anyOf($selectedStatuses).reverse().sortBy("_", ary => {
    					return ary.sort((a, b) => {
    						const i = new Date(1970, 1, 1);
    						return (a.updated_at || i) < (b.updated_at || i);
    					});
    				}));
    			}
    		}
    	};

    	return [issuesPromise, $selectedStatuses, click_handler, checkbox_group_binding];
    }

    class Issue_list extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src/icons/menu.svg generated by Svelte v3.24.1 */

    function create_fragment$4(ctx) {
    	let svg;
    	let defs;
    	let g;
    	let path0;
    	let path1;
    	let use0;
    	let use1;
    	let use2;

    	return {
    		c() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			use0 = svg_element("use");
    			use1 = svg_element("use");
    			use2 = svg_element("use");
    			attr(path0, "d", "M 0 2.5 a 2.5 2.5 0 0 1 5 0");
    			attr(path1, "d", "M 0 2.5 a 2.5 2.5 0 0 0 5 0");
    			attr(g, "id", "circle");
    			xlink_attr(use0, "xlink:href", "#circle");
    			attr(use0, "x", "10");
    			attr(use0, "y", "2");
    			xlink_attr(use1, "xlink:href", "#circle");
    			attr(use1, "x", "10");
    			attr(use1, "y", "10");
    			xlink_attr(use2, "xlink:href", "#circle");
    			attr(use2, "x", "10");
    			attr(use2, "y", "18");
    			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr(svg, "xmlns:xlink", "http://www.w3.org/1999/xlink");
    			attr(svg, "fill", "#000000");
    			attr(svg, "viewBox", "0 0 24 24");
    			attr(svg, "width", "24px");
    			attr(svg, "height", "24px");
    		},
    		m(target, anchor) {
    			insert(target, svg, anchor);
    			append(svg, defs);
    			append(defs, g);
    			append(g, path0);
    			append(g, path1);
    			append(svg, use0);
    			append(svg, use1);
    			append(svg, use2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(svg);
    		}
    	};
    }

    class Menu extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$4, safe_not_equal, {});
    	}
    }

    /* src/common/MenuButton.svelte generated by Svelte v3.24.1 */

    function create_default_slot_1(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = Menu;

    	function switch_props(ctx) {
    		return {};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	return {
    		c() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (switch_value !== (switch_value = Menu)) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    // (6:0) <Button on:click icon color='#00796b' unelevated dense>
    function create_default_slot$2(ctx) {
    	let icon;
    	let current;

    	icon = new Me({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(icon.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(icon, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const icon_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				icon_changes.$$scope = { dirty, ctx };
    			}

    			icon.$set(icon_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(icon.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(icon.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(icon, detaching);
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let button;
    	let current;

    	button = new ye({
    			props: {
    				icon: true,
    				color: "#00796b",
    				unelevated: true,
    				dense: true,
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*click_handler*/ ctx[0]);

    	return {
    		c() {
    			create_component(button.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(button, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(button, detaching);
    		}
    	};
    }

    function instance$4($$self) {
    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	return [click_handler];
    }

    class MenuButton extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$5, safe_not_equal, {});
    	}
    }

    /* src/common/DeleteConfirmationDialog.svelte generated by Svelte v3.24.1 */

    function create_title_slot(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "Confirmation";
    			attr(div, "slot", "title");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (26:4) <Button on:click={onCancelButtonPushed}>
    function create_default_slot_2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Cancel");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (27:4) <Button style="color: var(--danger);" on:click={onDeleteButtonPushed}>
    function create_default_slot_1$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Delete");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (25:2) <div slot="actions" class="actions center">
    function create_actions_slot(ctx) {
    	let div;
    	let button0;
    	let t;
    	let button1;
    	let current;

    	button0 = new ye({
    			props: {
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			}
    		});

    	button0.$on("click", /*onCancelButtonPushed*/ ctx[2]);

    	button1 = new ye({
    			props: {
    				style: "color: var(--danger);",
    				$$slots: { default: [create_default_slot_1$1] },
    				$$scope: { ctx }
    			}
    		});

    	button1.$on("click", /*onDeleteButtonPushed*/ ctx[3]);

    	return {
    		c() {
    			div = element("div");
    			create_component(button0.$$.fragment);
    			t = space();
    			create_component(button1.$$.fragment);
    			attr(div, "slot", "actions");
    			attr(div, "class", "actions center");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(button0, div, null);
    			append(div, t);
    			mount_component(button1, div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const button0_changes = {};

    			if (dirty & /*$$scope*/ 128) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};

    			if (dirty & /*$$scope*/ 128) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(button0);
    			destroy_component(button1);
    		}
    	};
    }

    // (22:0) <Dialog bind:visible>
    function create_default_slot$3(ctx) {
    	let t0;
    	let p;
    	let t1;
    	let t2;

    	return {
    		c() {
    			t0 = space();
    			p = element("p");
    			t1 = text(/*message*/ ctx[1]);
    			t2 = space();
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, p, anchor);
    			append(p, t1);
    			insert(target, t2, anchor);
    		},
    		p(ctx, dirty) {
    			set_data(t1, /*message*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(t0);
    			if (detaching) detach(p);
    			if (detaching) detach(t2);
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	let dialog;
    	let updating_visible;
    	let current;

    	function dialog_visible_binding(value) {
    		/*dialog_visible_binding*/ ctx[5].call(null, value);
    	}

    	let dialog_props = {
    		$$slots: {
    			default: [create_default_slot$3],
    			actions: [create_actions_slot],
    			title: [create_title_slot]
    		},
    		$$scope: { ctx }
    	};

    	if (/*visible*/ ctx[0] !== void 0) {
    		dialog_props.visible = /*visible*/ ctx[0];
    	}

    	dialog = new pn({ props: dialog_props });
    	binding_callbacks.push(() => bind(dialog, "visible", dialog_visible_binding));

    	return {
    		c() {
    			create_component(dialog.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(dialog, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const dialog_changes = {};

    			if (dirty & /*$$scope, message*/ 130) {
    				dialog_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_visible && dirty & /*visible*/ 1) {
    				updating_visible = true;
    				dialog_changes.visible = /*visible*/ ctx[0];
    				add_flush_callback(() => updating_visible = false);
    			}

    			dialog.$set(dialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(dialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(dialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(dialog, detaching);
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { visible = false } = $$props;
    	let { target = null } = $$props;
    	let { message = "Are you sure?" } = $$props;

    	function onCancelButtonPushed() {
    		$$invalidate(0, visible = false);
    	}

    	async function onDeleteButtonPushed() {
    		$$invalidate(0, visible = false);
    		dispatch("do-delete", target);
    	}

    	function dialog_visible_binding(value) {
    		visible = value;
    		$$invalidate(0, visible);
    	}

    	$$self.$$set = $$props => {
    		if ("visible" in $$props) $$invalidate(0, visible = $$props.visible);
    		if ("target" in $$props) $$invalidate(4, target = $$props.target);
    		if ("message" in $$props) $$invalidate(1, message = $$props.message);
    	};

    	return [
    		visible,
    		message,
    		onCancelButtonPushed,
    		onDeleteButtonPushed,
    		target,
    		dialog_visible_binding
    	];
    }

    class DeleteConfirmationDialog extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$6, safe_not_equal, { visible: 0, target: 4, message: 1 });
    	}
    }

    /* src/common/RstViewer.svelte generated by Svelte v3.24.1 */

    function create_if_block_1(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "loading...";
    			set_style(p, "text-align", "center");
    			set_style(p, "color", "#AAA");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (52:2) {#if html}
    function create_if_block(ctx) {
    	let html_tag;
    	let html_anchor;

    	return {
    		c() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m(target, anchor) {
    			html_tag.m(/*html*/ ctx[0], target, anchor);
    			insert(target, html_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*html*/ 1) html_tag.p(/*html*/ ctx[0]);
    		},
    		d(detaching) {
    			if (detaching) detach(html_anchor);
    			if (detaching) html_tag.d();
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*html*/ ctx[0]) return create_if_block;
    		if (/*loading*/ ctx[1]) return create_if_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			set_style(div, "overflow", "scroll");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block) if_block.m(div, null);

    			if (!mounted) {
    				dispose = listen(div, "click", /*captureClick*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);

    			if (if_block) {
    				if_block.d();
    			}

    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { rst } = $$props;
    	let html = "";
    	let loading = false;

    	async function refresh(rst) {
    		if (typeof rst !== "string" || rst === "") {
    			return;
    		}

    		$$invalidate(1, loading = true);
    		$$invalidate(0, html = await getHTML(rst));
    		$$invalidate(1, loading = false);
    	}

    	

    	function captureClick(event) {
    		if (event.target.tagName !== "A") {
    			return;
    		}

    		// Ignore external link
    		if (event.target.hostname !== window.location.hostname) {
    			return;
    		}

    		// Ignore fragment jump
    		if (event.target.pathname === window.location.pathname && event.target.hash !== window.location.hash) {
    			return;
    		}

    		if (event.target.pathname) {
    			event.preventDefault();
    			push(event.target.href);
    		}
    	}

    	$$self.$$set = $$props => {
    		if ("rst" in $$props) $$invalidate(3, rst = $$props.rst);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*rst*/ 8) {
    			 refresh(rst);
    		}

    		if ($$self.$$.dirty & /*html*/ 1) {
    			// Render mermaid diagram if contained
    			 if (typeof html === "string" && html.includes("mermaid")) {
    				tick().then(() => {
    					mermaid.init();
    				});
    			}
    		}
    	};

    	return [html, loading, captureClick, rst];
    }

    class RstViewer extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$6, create_fragment$7, safe_not_equal, { rst: 3 });
    	}
    }

    /**
     * Copied from svelte-mui. original license is below
     *
     * Copyright (c) 2019-2020 vikignt
     * Licensed under the MIT License (MIT), see
     * https://github.com/vikignt/svelte-mui
     */

    function getEventsAction(component) {
      return (node) => {
        const events = Object.keys(component.$$.callbacks);
        const listeners = [];

        events.forEach((event) =>
          listeners.push(listen(node, event, (e) => bubble(component, e)))
        );

        return {
          destroy: () => {
            listeners.forEach((listener) => listener());
          },
        };
      };
    }

    /* src/mui/TextArea.svelte generated by Svelte v3.24.1 */

    function create_if_block_2(ctx) {
    	let span;

    	return {
    		c() {
    			span = element("span");
    			span.textContent = "*";
    			attr(span, "class", "required svelte-f29m1o");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (25:1) {#if !outlined || filled}
    function create_if_block_1$1(ctx) {
    	let div0;
    	let t;
    	let div1;

    	return {
    		c() {
    			div0 = element("div");
    			t = space();
    			div1 = element("div");
    			attr(div0, "class", "input-line svelte-f29m1o");
    			attr(div1, "class", "focus-line svelte-f29m1o");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t, anchor);
    			insert(target, div1, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t);
    			if (detaching) detach(div1);
    		}
    	};
    }

    // (30:1) {#if !!message || !!error}
    function create_if_block$1(ctx) {
    	let div1;
    	let div0;
    	let t_value = (/*error*/ ctx[12] || /*message*/ ctx[11]) + "";
    	let t;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			t = text(t_value);
    			attr(div0, "class", "message");
    			attr(div1, "class", "help svelte-f29m1o");
    			toggle_class(div1, "persist", /*messagePersist*/ ctx[10]);
    			toggle_class(div1, "error", /*error*/ ctx[12]);
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*error, message*/ 6144 && t_value !== (t_value = (/*error*/ ctx[12] || /*message*/ ctx[11]) + "")) set_data(t, t_value);

    			if (dirty & /*messagePersist*/ 1024) {
    				toggle_class(div1, "persist", /*messagePersist*/ ctx[10]);
    			}

    			if (dirty & /*error*/ 4096) {
    				toggle_class(div1, "error", /*error*/ ctx[12]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	let div2;
    	let textarea;
    	let events_action;
    	let t0;
    	let div0;
    	let t1;
    	let div1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let div2_class_value;
    	let mounted;
    	let dispose;
    	let textarea_levels = [{ class: "input" }, /*attrs*/ ctx[13], { rows: /*rows*/ ctx[6] }];
    	let textarea_data = {};

    	for (let i = 0; i < textarea_levels.length; i += 1) {
    		textarea_data = assign(textarea_data, textarea_levels[i]);
    	}

    	let if_block0 = /*required*/ ctx[2] && !/*value*/ ctx[0].length && create_if_block_2();
    	let if_block1 = (!/*outlined*/ ctx[8] || /*filled*/ ctx[9]) && create_if_block_1$1();
    	let if_block2 = (!!/*message*/ ctx[11] || !!/*error*/ ctx[12]) && create_if_block$1(ctx);

    	return {
    		c() {
    			div2 = element("div");
    			textarea = element("textarea");
    			t0 = space();
    			div0 = element("div");
    			t1 = space();
    			div1 = element("div");
    			t2 = text(/*label*/ ctx[7]);
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			if (if_block2) if_block2.c();
    			set_attributes(textarea, textarea_data);
    			toggle_class(textarea, "svelte-f29m1o", true);
    			attr(div0, "class", "focus-ring svelte-f29m1o");
    			attr(div1, "class", "label svelte-f29m1o");

    			attr(div2, "class", div2_class_value = "" + (null_to_empty(`text-area ${/*outlined*/ ctx[8] && !/*filled*/ ctx[9]
			? "outlined"
			: "baseline"} ${/*className*/ ctx[3]}`) + " svelte-f29m1o"));

    			attr(div2, "style", /*style*/ ctx[4]);
    			attr(div2, "title", /*title*/ ctx[5]);
    			toggle_class(div2, "filled", /*filled*/ ctx[9]);
    			toggle_class(div2, "dirty", /*dirty*/ ctx[14]);
    			toggle_class(div2, "disabled", /*disabled*/ ctx[1]);
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, textarea);
    			set_input_value(textarea, /*value*/ ctx[0]);
    			append(div2, t0);
    			append(div2, div0);
    			append(div2, t1);
    			append(div2, div1);
    			append(div1, t2);
    			append(div1, t3);
    			if (if_block0) if_block0.m(div1, null);
    			append(div2, t4);
    			if (if_block1) if_block1.m(div2, null);
    			append(div2, t5);
    			if (if_block2) if_block2.m(div2, null);

    			if (!mounted) {
    				dispose = [
    					listen(textarea, "input", /*textarea_input_handler*/ ctx[16]),
    					action_destroyer(events_action = /*events*/ ctx[15].call(null, textarea))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			set_attributes(textarea, textarea_data = get_spread_update(textarea_levels, [
    				{ class: "input" },
    				dirty & /*attrs*/ 8192 && /*attrs*/ ctx[13],
    				dirty & /*rows*/ 64 && { rows: /*rows*/ ctx[6] }
    			]));

    			if (dirty & /*value*/ 1) {
    				set_input_value(textarea, /*value*/ ctx[0]);
    			}

    			toggle_class(textarea, "svelte-f29m1o", true);
    			if (dirty & /*label*/ 128) set_data(t2, /*label*/ ctx[7]);

    			if (/*required*/ ctx[2] && !/*value*/ ctx[0].length) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_2();
    					if_block0.c();
    					if_block0.m(div1, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (!/*outlined*/ ctx[8] || /*filled*/ ctx[9]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_1$1();
    					if_block1.c();
    					if_block1.m(div2, t5);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (!!/*message*/ ctx[11] || !!/*error*/ ctx[12]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.m(div2, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*outlined, filled, className*/ 776 && div2_class_value !== (div2_class_value = "" + (null_to_empty(`text-area ${/*outlined*/ ctx[8] && !/*filled*/ ctx[9]
			? "outlined"
			: "baseline"} ${/*className*/ ctx[3]}`) + " svelte-f29m1o"))) {
    				attr(div2, "class", div2_class_value);
    			}

    			if (dirty & /*style*/ 16) {
    				attr(div2, "style", /*style*/ ctx[4]);
    			}

    			if (dirty & /*title*/ 32) {
    				attr(div2, "title", /*title*/ ctx[5]);
    			}

    			if (dirty & /*outlined, filled, className, filled*/ 776) {
    				toggle_class(div2, "filled", /*filled*/ ctx[9]);
    			}

    			if (dirty & /*outlined, filled, className, dirty*/ 17160) {
    				toggle_class(div2, "dirty", /*dirty*/ ctx[14]);
    			}

    			if (dirty & /*outlined, filled, className, disabled*/ 778) {
    				toggle_class(div2, "disabled", /*disabled*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	const events = getEventsAction(current_component);
    	let { value = "" } = $$props;
    	let { disabled = false } = $$props;
    	let { required = false } = $$props;
    	let { class: className = "" } = $$props;
    	let { style = null } = $$props;
    	let { title = null } = $$props;
    	let { rows = 1 } = $$props;
    	let { label = "" } = $$props;
    	let { outlined = false } = $$props;
    	let { filled = false } = $$props;
    	let { messagePersist = false } = $$props;
    	let { message = "" } = $$props;
    	let { error = "" } = $$props;
    	let placeholder;
    	let attrs = {};

    	function textarea_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(18, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("value" in $$new_props) $$invalidate(0, value = $$new_props.value);
    		if ("disabled" in $$new_props) $$invalidate(1, disabled = $$new_props.disabled);
    		if ("required" in $$new_props) $$invalidate(2, required = $$new_props.required);
    		if ("class" in $$new_props) $$invalidate(3, className = $$new_props.class);
    		if ("style" in $$new_props) $$invalidate(4, style = $$new_props.style);
    		if ("title" in $$new_props) $$invalidate(5, title = $$new_props.title);
    		if ("rows" in $$new_props) $$invalidate(6, rows = $$new_props.rows);
    		if ("label" in $$new_props) $$invalidate(7, label = $$new_props.label);
    		if ("outlined" in $$new_props) $$invalidate(8, outlined = $$new_props.outlined);
    		if ("filled" in $$new_props) $$invalidate(9, filled = $$new_props.filled);
    		if ("messagePersist" in $$new_props) $$invalidate(10, messagePersist = $$new_props.messagePersist);
    		if ("message" in $$new_props) $$invalidate(11, message = $$new_props.message);
    		if ("error" in $$new_props) $$invalidate(12, error = $$new_props.error);
    	};

    	let dirty;

    	$$self.$$.update = () => {
    		 {
    			/* eslint-disable no-unused-vars */
    			const { value, style, title, rows, label, outlined, filled, messagePersist, message, error, ...other } = $$props;

    			!other.readonly && delete other.readonly;
    			!other.disabled && delete other.disabled;
    			delete other.class;
    			$$invalidate(17, placeholder = other.placeholder);
    			$$invalidate(13, attrs = other);
    		}

    		if ($$self.$$.dirty & /*value, placeholder*/ 131073) {
    			 $$invalidate(14, dirty = typeof value === "string" && value.length > 0 || placeholder);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		value,
    		disabled,
    		required,
    		className,
    		style,
    		title,
    		rows,
    		label,
    		outlined,
    		filled,
    		messagePersist,
    		message,
    		error,
    		attrs,
    		dirty,
    		events,
    		textarea_input_handler
    	];
    }

    class TextArea extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$7, create_fragment$8, safe_not_equal, {
    			value: 0,
    			disabled: 1,
    			required: 2,
    			class: 3,
    			style: 4,
    			title: 5,
    			rows: 6,
    			label: 7,
    			outlined: 8,
    			filled: 9,
    			messagePersist: 10,
    			message: 11,
    			error: 12
    		});
    	}
    }

    /* src/common/IssueForm.svelte generated by Svelte v3.24.1 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (40:2) <Radio bind:group={status} value={st}>
    function create_default_slot_4(ctx) {
    	let t_value = ISSUE_STATUSES[/*st*/ ctx[14]] + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (39:2) {#each Object.keys(ISSUE_STATUSES) as st }
    function create_each_block$1(ctx) {
    	let radio;
    	let updating_group;
    	let current;

    	function radio_group_binding(value) {
    		/*radio_group_binding*/ ctx[9].call(null, value);
    	}

    	let radio_props = {
    		value: /*st*/ ctx[14],
    		$$slots: { default: [create_default_slot_4] },
    		$$scope: { ctx }
    	};

    	if (/*status*/ ctx[2] !== void 0) {
    		radio_props.group = /*status*/ ctx[2];
    	}

    	radio = new Fn({ props: radio_props });
    	binding_callbacks.push(() => bind(radio, "group", radio_group_binding));

    	return {
    		c() {
    			create_component(radio.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(radio, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const radio_changes = {};

    			if (dirty & /*$$scope*/ 131072) {
    				radio_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_group && dirty & /*status*/ 4) {
    				updating_group = true;
    				radio_changes.group = /*status*/ ctx[2];
    				add_flush_callback(() => updating_group = false);
    			}

    			radio.$set(radio_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(radio.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(radio.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(radio, detaching);
    		}
    	};
    }

    // (52:2) <Button on:click="{onCancelButtonPushed}">
    function create_default_slot_3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Cancel");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (53:2) <Button disabled={!previewEabled} on:click={() => { showPreview = true }}>
    function create_default_slot_2$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Preview");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (54:2) <Button disabled={!saveEnabled} color="primary" on:click={onSaveButtonPushed}>
    function create_default_slot_1$2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Save");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (57:4) <div slot="title"p>
    function create_title_slot$1(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "Preview";
    			attr(div, "slot", "title");
    			attr(div, "p", "");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (56:2) <Dialog width="500" bind:visible={showPreview}>
    function create_default_slot$4(ctx) {
    	let t;
    	let rstviewer;
    	let current;
    	rstviewer = new RstViewer({ props: { rst: /*body*/ ctx[1] } });

    	return {
    		c() {
    			t = space();
    			create_component(rstviewer.$$.fragment);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    			mount_component(rstviewer, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const rstviewer_changes = {};
    			if (dirty & /*body*/ 2) rstviewer_changes.rst = /*body*/ ctx[1];
    			rstviewer.$set(rstviewer_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(rstviewer.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(rstviewer.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    			destroy_component(rstviewer, detaching);
    		}
    	};
    }

    function create_fragment$9(ctx) {
    	let div;
    	let textfield;
    	let updating_value;
    	let t0;
    	let t1;
    	let textarea;
    	let updating_value_1;
    	let t2;
    	let button0;
    	let t3;
    	let button1;
    	let t4;
    	let button2;
    	let t5;
    	let dialog;
    	let updating_visible;
    	let current;

    	function textfield_value_binding(value) {
    		/*textfield_value_binding*/ ctx[8].call(null, value);
    	}

    	let textfield_props = {
    		name: "title",
    		autocomplete: "off",
    		required: true,
    		label: "title",
    		message: ""
    	};

    	if (/*title*/ ctx[0] !== void 0) {
    		textfield_props.value = /*title*/ ctx[0];
    	}

    	textfield = new Ve({ props: textfield_props });
    	binding_callbacks.push(() => bind(textfield, "value", textfield_value_binding));
    	let each_value = Object.keys(ISSUE_STATUSES);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	function textarea_value_binding(value) {
    		/*textarea_value_binding*/ ctx[10].call(null, value);
    	}

    	let textarea_props = {
    		name: "body",
    		required: true,
    		rows: Math.min(/*body*/ ctx[1].split("\n").length + 3, 30),
    		label: "body",
    		style: "font-family: monospace; font-size: 1em;"
    	};

    	if (/*body*/ ctx[1] !== void 0) {
    		textarea_props.value = /*body*/ ctx[1];
    	}

    	textarea = new TextArea({ props: textarea_props });
    	binding_callbacks.push(() => bind(textarea, "value", textarea_value_binding));

    	button0 = new ye({
    			props: {
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			}
    		});

    	button0.$on("click", /*onCancelButtonPushed*/ ctx[7]);

    	button1 = new ye({
    			props: {
    				disabled: !/*previewEabled*/ ctx[4],
    				$$slots: { default: [create_default_slot_2$1] },
    				$$scope: { ctx }
    			}
    		});

    	button1.$on("click", /*click_handler*/ ctx[11]);

    	button2 = new ye({
    			props: {
    				disabled: !/*saveEnabled*/ ctx[5],
    				color: "primary",
    				$$slots: { default: [create_default_slot_1$2] },
    				$$scope: { ctx }
    			}
    		});

    	button2.$on("click", /*onSaveButtonPushed*/ ctx[6]);

    	function dialog_visible_binding(value) {
    		/*dialog_visible_binding*/ ctx[12].call(null, value);
    	}

    	let dialog_props = {
    		width: "500",
    		$$slots: {
    			default: [create_default_slot$4],
    			title: [create_title_slot$1]
    		},
    		$$scope: { ctx }
    	};

    	if (/*showPreview*/ ctx[3] !== void 0) {
    		dialog_props.visible = /*showPreview*/ ctx[3];
    	}

    	dialog = new pn({ props: dialog_props });
    	binding_callbacks.push(() => bind(dialog, "visible", dialog_visible_binding));

    	return {
    		c() {
    			div = element("div");
    			create_component(textfield.$$.fragment);
    			t0 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			create_component(textarea.$$.fragment);
    			t2 = space();
    			create_component(button0.$$.fragment);
    			t3 = space();
    			create_component(button1.$$.fragment);
    			t4 = space();
    			create_component(button2.$$.fragment);
    			t5 = space();
    			create_component(dialog.$$.fragment);
    			attr(div, "class", "issueForm");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(textfield, div, null);
    			append(div, t0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t1);
    			mount_component(textarea, div, null);
    			append(div, t2);
    			mount_component(button0, div, null);
    			append(div, t3);
    			mount_component(button1, div, null);
    			append(div, t4);
    			mount_component(button2, div, null);
    			append(div, t5);
    			mount_component(dialog, div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const textfield_changes = {};

    			if (!updating_value && dirty & /*title*/ 1) {
    				updating_value = true;
    				textfield_changes.value = /*title*/ ctx[0];
    				add_flush_callback(() => updating_value = false);
    			}

    			textfield.$set(textfield_changes);

    			if (dirty & /*Object, ISSUE_STATUSES, status*/ 4) {
    				each_value = Object.keys(ISSUE_STATUSES);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, t1);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			const textarea_changes = {};
    			if (dirty & /*body*/ 2) textarea_changes.rows = Math.min(/*body*/ ctx[1].split("\n").length + 3, 30);

    			if (!updating_value_1 && dirty & /*body*/ 2) {
    				updating_value_1 = true;
    				textarea_changes.value = /*body*/ ctx[1];
    				add_flush_callback(() => updating_value_1 = false);
    			}

    			textarea.$set(textarea_changes);
    			const button0_changes = {};

    			if (dirty & /*$$scope*/ 131072) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};
    			if (dirty & /*previewEabled*/ 16) button1_changes.disabled = !/*previewEabled*/ ctx[4];

    			if (dirty & /*$$scope*/ 131072) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    			const button2_changes = {};
    			if (dirty & /*saveEnabled*/ 32) button2_changes.disabled = !/*saveEnabled*/ ctx[5];

    			if (dirty & /*$$scope*/ 131072) {
    				button2_changes.$$scope = { dirty, ctx };
    			}

    			button2.$set(button2_changes);
    			const dialog_changes = {};

    			if (dirty & /*$$scope, body*/ 131074) {
    				dialog_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_visible && dirty & /*showPreview*/ 8) {
    				updating_visible = true;
    				dialog_changes.visible = /*showPreview*/ ctx[3];
    				add_flush_callback(() => updating_visible = false);
    			}

    			dialog.$set(dialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(textfield.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(textarea.$$.fragment, local);
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			transition_in(button2.$$.fragment, local);
    			transition_in(dialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(textfield.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(textarea.$$.fragment, local);
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			transition_out(button2.$$.fragment, local);
    			transition_out(dialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(textfield);
    			destroy_each(each_blocks, detaching);
    			destroy_component(textarea);
    			destroy_component(button0);
    			destroy_component(button1);
    			destroy_component(button2);
    			destroy_component(dialog);
    		}
    	};
    }

    function instance$8($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { title = "" } = $$props;
    	let { body = "" } = $$props;
    	let { status = "OPEN" } = $$props;
    	let showPreview = false;

    	async function onSaveButtonPushed() {
    		const data = { title, body, status };
    		dispatch("save", data);
    	}

    	async function onCancelButtonPushed() {
    		dispatch("cancel");
    	}

    	function textfield_value_binding(value) {
    		title = value;
    		$$invalidate(0, title);
    	}

    	function radio_group_binding(value) {
    		status = value;
    		$$invalidate(2, status);
    	}

    	function textarea_value_binding(value) {
    		body = value;
    		$$invalidate(1, body);
    	}

    	const click_handler = () => {
    		$$invalidate(3, showPreview = true);
    	};

    	function dialog_visible_binding(value) {
    		showPreview = value;
    		$$invalidate(3, showPreview);
    	}

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("body" in $$props) $$invalidate(1, body = $$props.body);
    		if ("status" in $$props) $$invalidate(2, status = $$props.status);
    	};

    	let previewEabled;
    	let saveEnabled;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*body*/ 2) {
    			 $$invalidate(4, previewEabled = body !== "");
    		}

    		if ($$self.$$.dirty & /*title*/ 1) {
    			 $$invalidate(5, saveEnabled = title !== "");
    		}
    	};

    	return [
    		title,
    		body,
    		status,
    		showPreview,
    		previewEabled,
    		saveEnabled,
    		onSaveButtonPushed,
    		onCancelButtonPushed,
    		textfield_value_binding,
    		radio_group_binding,
    		textarea_value_binding,
    		click_handler,
    		dialog_visible_binding
    	];
    }

    class IssueForm extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$8, create_fragment$9, safe_not_equal, { title: 0, body: 1, status: 2 });
    	}
    }

    /* src/pages/issue_view/CommentForm.svelte generated by Svelte v3.24.1 */

    function create_if_block$2(ctx) {
    	let button;
    	let current;

    	button = new ye({
    			props: {
    				$$slots: { default: [create_default_slot_3$1] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*onCancelButtonPushed*/ ctx[6]);

    	return {
    		c() {
    			create_component(button.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(button, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 4096) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(button, detaching);
    		}
    	};
    }

    // (47:2) <Button on:click={onCancelButtonPushed}>
    function create_default_slot_3$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Cancel");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (49:2) <Button disabled={!previewEnabled} on:click={onPreviewButtonPushed}>
    function create_default_slot_2$2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Preview");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (50:2) <Button disabled={!saveEnabled} color="primary" on:click={onSaveButtonPushed}>
    function create_default_slot_1$3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Save");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (53:4) <div slot="title"p>
    function create_title_slot$2(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "Preview";
    			attr(div, "slot", "title");
    			attr(div, "p", "");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (52:2) <Dialog width="500" bind:visible={showPreview}>
    function create_default_slot$5(ctx) {
    	let t;
    	let rstviewer;
    	let current;
    	rstviewer = new RstViewer({ props: { rst: /*body*/ ctx[0] } });

    	return {
    		c() {
    			t = space();
    			create_component(rstviewer.$$.fragment);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    			mount_component(rstviewer, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const rstviewer_changes = {};
    			if (dirty & /*body*/ 1) rstviewer_changes.rst = /*body*/ ctx[0];
    			rstviewer.$set(rstviewer_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(rstviewer.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(rstviewer.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    			destroy_component(rstviewer, detaching);
    		}
    	};
    }

    function create_fragment$a(ctx) {
    	let div;
    	let textarea;
    	let updating_value;
    	let t0;
    	let t1;
    	let button0;
    	let t2;
    	let button1;
    	let t3;
    	let dialog;
    	let updating_visible;
    	let current;

    	function textarea_value_binding(value) {
    		/*textarea_value_binding*/ ctx[9].call(null, value);
    	}

    	let textarea_props = {
    		name: "body",
    		required: true,
    		rows: Math.min(/*body*/ ctx[0].split("\n").length + 3, 30),
    		label: "body",
    		style: "font-family: monospace; font-size: 1em;"
    	};

    	if (/*body*/ ctx[0] !== void 0) {
    		textarea_props.value = /*body*/ ctx[0];
    	}

    	textarea = new TextArea({ props: textarea_props });
    	binding_callbacks.push(() => bind(textarea, "value", textarea_value_binding));
    	let if_block = /*id*/ ctx[1] !== null && create_if_block$2(ctx);

    	button0 = new ye({
    			props: {
    				disabled: !/*previewEnabled*/ ctx[3],
    				$$slots: { default: [create_default_slot_2$2] },
    				$$scope: { ctx }
    			}
    		});

    	button0.$on("click", /*onPreviewButtonPushed*/ ctx[7]);

    	button1 = new ye({
    			props: {
    				disabled: !/*saveEnabled*/ ctx[4],
    				color: "primary",
    				$$slots: { default: [create_default_slot_1$3] },
    				$$scope: { ctx }
    			}
    		});

    	button1.$on("click", /*onSaveButtonPushed*/ ctx[5]);

    	function dialog_visible_binding(value) {
    		/*dialog_visible_binding*/ ctx[10].call(null, value);
    	}

    	let dialog_props = {
    		width: "500",
    		$$slots: {
    			default: [create_default_slot$5],
    			title: [create_title_slot$2]
    		},
    		$$scope: { ctx }
    	};

    	if (/*showPreview*/ ctx[2] !== void 0) {
    		dialog_props.visible = /*showPreview*/ ctx[2];
    	}

    	dialog = new pn({ props: dialog_props });
    	binding_callbacks.push(() => bind(dialog, "visible", dialog_visible_binding));

    	return {
    		c() {
    			div = element("div");
    			create_component(textarea.$$.fragment);
    			t0 = space();
    			if (if_block) if_block.c();
    			t1 = space();
    			create_component(button0.$$.fragment);
    			t2 = space();
    			create_component(button1.$$.fragment);
    			t3 = space();
    			create_component(dialog.$$.fragment);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(textarea, div, null);
    			append(div, t0);
    			if (if_block) if_block.m(div, null);
    			append(div, t1);
    			mount_component(button0, div, null);
    			append(div, t2);
    			mount_component(button1, div, null);
    			append(div, t3);
    			mount_component(dialog, div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const textarea_changes = {};
    			if (dirty & /*body*/ 1) textarea_changes.rows = Math.min(/*body*/ ctx[0].split("\n").length + 3, 30);

    			if (!updating_value && dirty & /*body*/ 1) {
    				updating_value = true;
    				textarea_changes.value = /*body*/ ctx[0];
    				add_flush_callback(() => updating_value = false);
    			}

    			textarea.$set(textarea_changes);

    			if (/*id*/ ctx[1] !== null) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*id*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, t1);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			const button0_changes = {};
    			if (dirty & /*previewEnabled*/ 8) button0_changes.disabled = !/*previewEnabled*/ ctx[3];

    			if (dirty & /*$$scope*/ 4096) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};
    			if (dirty & /*saveEnabled*/ 16) button1_changes.disabled = !/*saveEnabled*/ ctx[4];

    			if (dirty & /*$$scope*/ 4096) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    			const dialog_changes = {};

    			if (dirty & /*$$scope, body*/ 4097) {
    				dialog_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_visible && dirty & /*showPreview*/ 4) {
    				updating_visible = true;
    				dialog_changes.visible = /*showPreview*/ ctx[2];
    				add_flush_callback(() => updating_visible = false);
    			}

    			dialog.$set(dialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(textarea.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			transition_in(dialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(textarea.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			transition_out(dialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(textarea);
    			if (if_block) if_block.d();
    			destroy_component(button0);
    			destroy_component(button1);
    			destroy_component(dialog);
    		}
    	};
    }

    function instance$9($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { issueId } = $$props;
    	let { body = "" } = $$props;
    	let { id = null } = $$props;
    	let showPreview = false;

    	async function onSaveButtonPushed() {
    		if (id === null) {
    			await addIssueComment(issueId, { body });
    			$$invalidate(0, body = "");
    		} else {
    			await updateIssueComment(issueId, id, { body });
    		}

    		dispatch("saved");
    	}

    	async function onCancelButtonPushed() {
    		dispatch("canceled");
    	}

    	function onPreviewButtonPushed() {
    		$$invalidate(2, showPreview = true);
    	}

    	function textarea_value_binding(value) {
    		body = value;
    		$$invalidate(0, body);
    	}

    	function dialog_visible_binding(value) {
    		showPreview = value;
    		$$invalidate(2, showPreview);
    	}

    	$$self.$$set = $$props => {
    		if ("issueId" in $$props) $$invalidate(8, issueId = $$props.issueId);
    		if ("body" in $$props) $$invalidate(0, body = $$props.body);
    		if ("id" in $$props) $$invalidate(1, id = $$props.id);
    	};

    	let previewEnabled;
    	let saveEnabled;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*body*/ 1) {
    			 $$invalidate(3, previewEnabled = body !== "");
    		}

    		if ($$self.$$.dirty & /*body*/ 1) {
    			 $$invalidate(4, saveEnabled = body !== "");
    		}
    	};

    	return [
    		body,
    		id,
    		showPreview,
    		previewEnabled,
    		saveEnabled,
    		onSaveButtonPushed,
    		onCancelButtonPushed,
    		onPreviewButtonPushed,
    		issueId,
    		textarea_value_binding,
    		dialog_visible_binding
    	];
    }

    class CommentForm extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$9, create_fragment$a, safe_not_equal, { issueId: 8, body: 0, id: 1 });
    	}
    }

    /* src/pages/issue_view/Comment.svelte generated by Svelte v3.24.1 */

    function create_else_block(ctx) {
    	let commentform;
    	let current;
    	const commentform_spread_levels = [{ issueId: /*issueId*/ ctx[0] }, /*comment*/ ctx[1]];
    	let commentform_props = {};

    	for (let i = 0; i < commentform_spread_levels.length; i += 1) {
    		commentform_props = assign(commentform_props, commentform_spread_levels[i]);
    	}

    	commentform = new CommentForm({ props: commentform_props });
    	commentform.$on("saved", /*onCommentSaved*/ ctx[5]);
    	commentform.$on("canceled", /*canceled_handler*/ ctx[8]);

    	return {
    		c() {
    			create_component(commentform.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(commentform, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const commentform_changes = (dirty & /*issueId, comment*/ 3)
    			? get_spread_update(commentform_spread_levels, [
    					dirty & /*issueId*/ 1 && { issueId: /*issueId*/ ctx[0] },
    					dirty & /*comment*/ 2 && get_spread_object(/*comment*/ ctx[1])
    				])
    			: {};

    			commentform.$set(commentform_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(commentform.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(commentform.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(commentform, detaching);
    		}
    	};
    }

    // (30:2) {#if !editing}
    function create_if_block$3(ctx) {
    	let div;
    	let rstviewer;
    	let t;
    	let menu;
    	let current;
    	rstviewer = new RstViewer({ props: { rst: /*comment*/ ctx[1].body } });

    	menu = new kn({
    			props: {
    				origin: "top right",
    				$$slots: {
    					default: [create_default_slot$6],
    					activator: [create_activator_slot]
    				},
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			div = element("div");
    			create_component(rstviewer.$$.fragment);
    			t = space();
    			create_component(menu.$$.fragment);
    			attr(div, "class", "flex-align-top");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(rstviewer, div, null);
    			append(div, t);
    			mount_component(menu, div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const rstviewer_changes = {};
    			if (dirty & /*comment*/ 2) rstviewer_changes.rst = /*comment*/ ctx[1].body;
    			rstviewer.$set(rstviewer_changes);
    			const menu_changes = {};

    			if (dirty & /*$$scope, editing*/ 1028) {
    				menu_changes.$$scope = { dirty, ctx };
    			}

    			menu.$set(menu_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(rstviewer.$$.fragment, local);
    			transition_in(menu.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(rstviewer.$$.fragment, local);
    			transition_out(menu.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(rstviewer);
    			destroy_component(menu);
    		}
    	};
    }

    // (34:8) <div slot="activator">
    function create_activator_slot(ctx) {
    	let div;
    	let menubutton;
    	let current;
    	menubutton = new MenuButton({});

    	return {
    		c() {
    			div = element("div");
    			create_component(menubutton.$$.fragment);
    			attr(div, "slot", "activator");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(menubutton, div, null);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(menubutton.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(menubutton.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(menubutton);
    		}
    	};
    }

    // (37:8) <Menuitem on:click={() => { editing = true; }}>
    function create_default_slot_2$3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Edit");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (38:8) <Menuitem style="color: var(--danger);" on:click={onDeleteMenuPushed}>
    function create_default_slot_1$4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Delete");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (33:6) <Menu origin="top right">
    function create_default_slot$6(ctx) {
    	let t0;
    	let menuitem0;
    	let t1;
    	let menuitem1;
    	let current;

    	menuitem0 = new jn({
    			props: {
    				$$slots: { default: [create_default_slot_2$3] },
    				$$scope: { ctx }
    			}
    		});

    	menuitem0.$on("click", /*click_handler*/ ctx[7]);

    	menuitem1 = new jn({
    			props: {
    				style: "color: var(--danger);",
    				$$slots: { default: [create_default_slot_1$4] },
    				$$scope: { ctx }
    			}
    		});

    	menuitem1.$on("click", /*onDeleteMenuPushed*/ ctx[4]);

    	return {
    		c() {
    			t0 = space();
    			create_component(menuitem0.$$.fragment);
    			t1 = space();
    			create_component(menuitem1.$$.fragment);
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			mount_component(menuitem0, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(menuitem1, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const menuitem0_changes = {};

    			if (dirty & /*$$scope*/ 1024) {
    				menuitem0_changes.$$scope = { dirty, ctx };
    			}

    			menuitem0.$set(menuitem0_changes);
    			const menuitem1_changes = {};

    			if (dirty & /*$$scope*/ 1024) {
    				menuitem1_changes.$$scope = { dirty, ctx };
    			}

    			menuitem1.$set(menuitem1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(menuitem0.$$.fragment, local);
    			transition_in(menuitem1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(menuitem0.$$.fragment, local);
    			transition_out(menuitem1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			destroy_component(menuitem0, detaching);
    			if (detaching) detach(t1);
    			destroy_component(menuitem1, detaching);
    		}
    	};
    }

    function create_fragment$b(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let t;
    	let deleteconfirmationdialog;
    	let updating_visible;
    	let current;
    	const if_block_creators = [create_if_block$3, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*editing*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	function deleteconfirmationdialog_visible_binding(value) {
    		/*deleteconfirmationdialog_visible_binding*/ ctx[9].call(null, value);
    	}

    	let deleteconfirmationdialog_props = { message: "Delete the comment ?" };

    	if (/*showDeleteConfirmation*/ ctx[3] !== void 0) {
    		deleteconfirmationdialog_props.visible = /*showDeleteConfirmation*/ ctx[3];
    	}

    	deleteconfirmationdialog = new DeleteConfirmationDialog({ props: deleteconfirmationdialog_props });
    	binding_callbacks.push(() => bind(deleteconfirmationdialog, "visible", deleteconfirmationdialog_visible_binding));
    	deleteconfirmationdialog.$on("do-delete", /*doDelete*/ ctx[6]);

    	return {
    		c() {
    			div = element("div");
    			if_block.c();
    			t = space();
    			create_component(deleteconfirmationdialog.$$.fragment);
    			attr(div, "class", "comment svelte-11cjbx0");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			append(div, t);
    			mount_component(deleteconfirmationdialog, div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, t);
    			}

    			const deleteconfirmationdialog_changes = {};

    			if (!updating_visible && dirty & /*showDeleteConfirmation*/ 8) {
    				updating_visible = true;
    				deleteconfirmationdialog_changes.visible = /*showDeleteConfirmation*/ ctx[3];
    				add_flush_callback(() => updating_visible = false);
    			}

    			deleteconfirmationdialog.$set(deleteconfirmationdialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(deleteconfirmationdialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			transition_out(deleteconfirmationdialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if_blocks[current_block_type_index].d();
    			destroy_component(deleteconfirmationdialog);
    		}
    	};
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { issueId } = $$props;
    	let { comment } = $$props;
    	let editing = false;
    	let showDeleteConfirmation = false;

    	function onDeleteMenuPushed() {
    		$$invalidate(3, showDeleteConfirmation = true);
    	}

    	function onCommentSaved() {
    		$$invalidate(2, editing = false);
    	}

    	async function doDelete() {
    		await deleteIssueComment(issueId, comment.id);
    	}

    	const click_handler = () => {
    		$$invalidate(2, editing = true);
    	};

    	const canceled_handler = () => {
    		$$invalidate(2, editing = false);
    	};

    	function deleteconfirmationdialog_visible_binding(value) {
    		showDeleteConfirmation = value;
    		$$invalidate(3, showDeleteConfirmation);
    	}

    	$$self.$$set = $$props => {
    		if ("issueId" in $$props) $$invalidate(0, issueId = $$props.issueId);
    		if ("comment" in $$props) $$invalidate(1, comment = $$props.comment);
    	};

    	return [
    		issueId,
    		comment,
    		editing,
    		showDeleteConfirmation,
    		onDeleteMenuPushed,
    		onCommentSaved,
    		doDelete,
    		click_handler,
    		canceled_handler,
    		deleteconfirmationdialog_visible_binding
    	];
    }

    class Comment extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$a, create_fragment$b, safe_not_equal, { issueId: 0, comment: 1 });
    	}
    }

    /* src/pages/issue_view/IssueView.svelte generated by Svelte v3.24.1 */

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (84:2) {:else}
    function create_else_block$1(ctx) {
    	let issueform;
    	let current;

    	issueform = new IssueForm({
    			props: {
    				title: /*issue*/ ctx[0].title,
    				status: /*issue*/ ctx[0].status,
    				body: /*issue*/ ctx[0].body
    			}
    		});

    	issueform.$on("save", /*onIssueSave*/ ctx[4]);
    	issueform.$on("cancel", /*onIssueCancel*/ ctx[5]);

    	return {
    		c() {
    			create_component(issueform.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(issueform, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const issueform_changes = {};
    			if (dirty & /*issue*/ 1) issueform_changes.title = /*issue*/ ctx[0].title;
    			if (dirty & /*issue*/ 1) issueform_changes.status = /*issue*/ ctx[0].status;
    			if (dirty & /*issue*/ 1) issueform_changes.body = /*issue*/ ctx[0].body;
    			issueform.$set(issueform_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(issueform.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(issueform.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(issueform, detaching);
    		}
    	};
    }

    // (49:2) {#if !editing }
    function create_if_block_1$2(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1_value = /*issue*/ ctx[0].shorten_id + "";
    	let t1;
    	let t2;
    	let t3;
    	let h1;
    	let t4_value = /*issue*/ ctx[0].title + "";
    	let t4;
    	let t5;
    	let menu;
    	let t6;
    	let div2;
    	let table0;
    	let tr0;
    	let th0;
    	let t8;
    	let td0;
    	let t9_value = /*issue*/ ctx[0].status_disp + "";
    	let t9;
    	let t10;
    	let table1;
    	let tr1;
    	let th1;
    	let t12;
    	let td1;
    	let t13_value = /*issue*/ ctx[0].createdAt + "";
    	let t13;
    	let t14;
    	let tr2;
    	let th2;
    	let t16;
    	let td2;
    	let t17_value = /*issue*/ ctx[0].updatedAt + "";
    	let t17;
    	let t18;
    	let if_block_anchor;
    	let current;

    	menu = new kn({
    			props: {
    				origin: "top right",
    				$$slots: {
    					default: [create_default_slot$7],
    					activator: [create_activator_slot$1]
    				},
    				$$scope: { ctx }
    			}
    		});

    	let if_block = typeof /*issue*/ ctx[0].body === "string" && /*issue*/ ctx[0].body !== "" && create_if_block_2$1(ctx);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("[");
    			t1 = text(t1_value);
    			t2 = text("]");
    			t3 = space();
    			h1 = element("h1");
    			t4 = text(t4_value);
    			t5 = space();
    			create_component(menu.$$.fragment);
    			t6 = space();
    			div2 = element("div");
    			table0 = element("table");
    			tr0 = element("tr");
    			th0 = element("th");
    			th0.textContent = "status:";
    			t8 = space();
    			td0 = element("td");
    			t9 = text(t9_value);
    			t10 = space();
    			table1 = element("table");
    			tr1 = element("tr");
    			th1 = element("th");
    			th1.textContent = "created at:";
    			t12 = space();
    			td1 = element("td");
    			t13 = text(t13_value);
    			t14 = space();
    			tr2 = element("tr");
    			th2 = element("th");
    			th2.textContent = "updated at:";
    			t16 = space();
    			td2 = element("td");
    			t17 = text(t17_value);
    			t18 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(div0, "class", "heading-id svelte-13z99ob");
    			attr(div1, "class", "heading svelte-13z99ob");
    			attr(div2, "class", "summary svelte-13z99ob");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, t0);
    			append(div0, t1);
    			append(div0, t2);
    			append(div1, t3);
    			append(div1, h1);
    			append(h1, t4);
    			append(div1, t5);
    			mount_component(menu, div1, null);
    			insert(target, t6, anchor);
    			insert(target, div2, anchor);
    			append(div2, table0);
    			append(table0, tr0);
    			append(tr0, th0);
    			append(tr0, t8);
    			append(tr0, td0);
    			append(td0, t9);
    			append(div2, t10);
    			append(div2, table1);
    			append(table1, tr1);
    			append(tr1, th1);
    			append(tr1, t12);
    			append(tr1, td1);
    			append(td1, t13);
    			append(table1, t14);
    			append(table1, tr2);
    			append(tr2, th2);
    			append(tr2, t16);
    			append(tr2, td2);
    			append(td2, t17);
    			insert(target, t18, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if ((!current || dirty & /*issue*/ 1) && t1_value !== (t1_value = /*issue*/ ctx[0].shorten_id + "")) set_data(t1, t1_value);
    			if ((!current || dirty & /*issue*/ 1) && t4_value !== (t4_value = /*issue*/ ctx[0].title + "")) set_data(t4, t4_value);
    			const menu_changes = {};

    			if (dirty & /*$$scope*/ 4096) {
    				menu_changes.$$scope = { dirty, ctx };
    			}

    			menu.$set(menu_changes);
    			if ((!current || dirty & /*issue*/ 1) && t9_value !== (t9_value = /*issue*/ ctx[0].status_disp + "")) set_data(t9, t9_value);
    			if ((!current || dirty & /*issue*/ 1) && t13_value !== (t13_value = /*issue*/ ctx[0].createdAt + "")) set_data(t13, t13_value);
    			if ((!current || dirty & /*issue*/ 1) && t17_value !== (t17_value = /*issue*/ ctx[0].updatedAt + "")) set_data(t17, t17_value);

    			if (typeof /*issue*/ ctx[0].body === "string" && /*issue*/ ctx[0].body !== "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*issue*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_2$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(menu.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			destroy_component(menu);
    			if (detaching) detach(t6);
    			if (detaching) detach(div2);
    			if (detaching) detach(t18);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (54:8) <div slot="activator">
    function create_activator_slot$1(ctx) {
    	let div;
    	let menubutton;
    	let current;
    	menubutton = new MenuButton({});

    	return {
    		c() {
    			div = element("div");
    			create_component(menubutton.$$.fragment);
    			attr(div, "slot", "activator");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(menubutton, div, null);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(menubutton.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(menubutton.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(menubutton);
    		}
    	};
    }

    // (57:8) <Menuitem on:click={onEditMenuPushed}>
    function create_default_slot_2$4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Edit");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (58:8) <Menuitem style="color: var(--danger);" on:click={onDeleteMenuPushed}>
    function create_default_slot_1$5(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Delete");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (53:6) <Menu origin="top right">
    function create_default_slot$7(ctx) {
    	let t0;
    	let menuitem0;
    	let t1;
    	let menuitem1;
    	let current;

    	menuitem0 = new jn({
    			props: {
    				$$slots: { default: [create_default_slot_2$4] },
    				$$scope: { ctx }
    			}
    		});

    	menuitem0.$on("click", /*onEditMenuPushed*/ ctx[3]);

    	menuitem1 = new jn({
    			props: {
    				style: "color: var(--danger);",
    				$$slots: { default: [create_default_slot_1$5] },
    				$$scope: { ctx }
    			}
    		});

    	menuitem1.$on("click", /*onDeleteMenuPushed*/ ctx[6]);

    	return {
    		c() {
    			t0 = space();
    			create_component(menuitem0.$$.fragment);
    			t1 = space();
    			create_component(menuitem1.$$.fragment);
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			mount_component(menuitem0, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(menuitem1, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const menuitem0_changes = {};

    			if (dirty & /*$$scope*/ 4096) {
    				menuitem0_changes.$$scope = { dirty, ctx };
    			}

    			menuitem0.$set(menuitem0_changes);
    			const menuitem1_changes = {};

    			if (dirty & /*$$scope*/ 4096) {
    				menuitem1_changes.$$scope = { dirty, ctx };
    			}

    			menuitem1.$set(menuitem1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(menuitem0.$$.fragment, local);
    			transition_in(menuitem1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(menuitem0.$$.fragment, local);
    			transition_out(menuitem1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			destroy_component(menuitem0, detaching);
    			if (detaching) detach(t1);
    			destroy_component(menuitem1, detaching);
    		}
    	};
    }

    // (79:4) {#if typeof issue.body === 'string' && issue.body !== ''}
    function create_if_block_2$1(ctx) {
    	let div;
    	let rstviewer;
    	let current;
    	rstviewer = new RstViewer({ props: { rst: /*issue*/ ctx[0].body } });

    	return {
    		c() {
    			div = element("div");
    			create_component(rstviewer.$$.fragment);
    			attr(div, "class", "issue-body svelte-13z99ob");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(rstviewer, div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const rstviewer_changes = {};
    			if (dirty & /*issue*/ 1) rstviewer_changes.rst = /*issue*/ ctx[0].body;
    			rstviewer.$set(rstviewer_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(rstviewer.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(rstviewer.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(rstviewer);
    		}
    	};
    }

    // (89:2) {#each issue.comments as comment}
    function create_each_block$2(ctx) {
    	let comment;
    	let current;

    	comment = new Comment({
    			props: {
    				issueId: /*issue*/ ctx[0].id,
    				comment: /*comment*/ ctx[9]
    			}
    		});

    	return {
    		c() {
    			create_component(comment.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(comment, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const comment_changes = {};
    			if (dirty & /*issue*/ 1) comment_changes.issueId = /*issue*/ ctx[0].id;
    			if (dirty & /*issue*/ 1) comment_changes.comment = /*comment*/ ctx[9];
    			comment.$set(comment_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(comment.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(comment.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(comment, detaching);
    		}
    	};
    }

    // (93:2) {#if !editing}
    function create_if_block$4(ctx) {
    	let div;
    	let h2;
    	let t1;
    	let commentform;
    	let current;
    	commentform = new CommentForm({ props: { issueId: /*issue*/ ctx[0].id } });

    	return {
    		c() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "New comment";
    			t1 = space();
    			create_component(commentform.$$.fragment);
    			attr(div, "class", "form-container svelte-13z99ob");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h2);
    			append(div, t1);
    			mount_component(commentform, div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const commentform_changes = {};
    			if (dirty & /*issue*/ 1) commentform_changes.issueId = /*issue*/ ctx[0].id;
    			commentform.$set(commentform_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(commentform.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(commentform.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(commentform);
    		}
    	};
    }

    function create_fragment$c(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block0;
    	let t0;
    	let t1;
    	let t2;
    	let deleteconfirmationdialog;
    	let updating_visible;
    	let current;
    	const if_block_creators = [create_if_block_1$2, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*editing*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let each_value = /*issue*/ ctx[0].comments;
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let if_block1 = !/*editing*/ ctx[1] && create_if_block$4(ctx);

    	function deleteconfirmationdialog_visible_binding(value) {
    		/*deleteconfirmationdialog_visible_binding*/ ctx[8].call(null, value);
    	}

    	let deleteconfirmationdialog_props = {
    		message: "Delete the issue '" + (/*issue*/ ctx[0] ? /*issue*/ ctx[0].title : "") + "' ?"
    	};

    	if (/*showDeleteConfirmation*/ ctx[2] !== void 0) {
    		deleteconfirmationdialog_props.visible = /*showDeleteConfirmation*/ ctx[2];
    	}

    	deleteconfirmationdialog = new DeleteConfirmationDialog({ props: deleteconfirmationdialog_props });
    	binding_callbacks.push(() => bind(deleteconfirmationdialog, "visible", deleteconfirmationdialog_visible_binding));
    	deleteconfirmationdialog.$on("do-delete", /*doDelete*/ ctx[7]);

    	return {
    		c() {
    			div = element("div");
    			if_block0.c();
    			t0 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			create_component(deleteconfirmationdialog.$$.fragment);
    			attr(div, "class", "issue-view card");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			append(div, t0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			append(div, t2);
    			mount_component(deleteconfirmationdialog, div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block0 = if_blocks[current_block_type_index];

    				if (!if_block0) {
    					if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block0.c();
    				}

    				transition_in(if_block0, 1);
    				if_block0.m(div, t0);
    			}

    			if (dirty & /*issue*/ 1) {
    				each_value = /*issue*/ ctx[0].comments;
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, t1);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!/*editing*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*editing*/ 2) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block$4(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div, t2);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			const deleteconfirmationdialog_changes = {};
    			if (dirty & /*issue*/ 1) deleteconfirmationdialog_changes.message = "Delete the issue '" + (/*issue*/ ctx[0] ? /*issue*/ ctx[0].title : "") + "' ?";

    			if (!updating_visible && dirty & /*showDeleteConfirmation*/ 4) {
    				updating_visible = true;
    				deleteconfirmationdialog_changes.visible = /*showDeleteConfirmation*/ ctx[2];
    				add_flush_callback(() => updating_visible = false);
    			}

    			deleteconfirmationdialog.$set(deleteconfirmationdialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block0);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(if_block1);
    			transition_in(deleteconfirmationdialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block0);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(if_block1);
    			transition_out(deleteconfirmationdialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if_blocks[current_block_type_index].d();
    			destroy_each(each_blocks, detaching);
    			if (if_block1) if_block1.d();
    			destroy_component(deleteconfirmationdialog);
    		}
    	};
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { issue } = $$props;
    	let editing = false;
    	let showDeleteConfirmation = false;

    	function onEditMenuPushed() {
    		$$invalidate(1, editing = true);
    	}

    	async function onIssueSave(event) {
    		try {
    			await updateIssue(issue.id, event.detail);
    			$$invalidate(1, editing = false);
    		} catch(error) {
    			console.error(error);
    		}
    	}

    	function onIssueCancel() {
    		$$invalidate(1, editing = false);
    	}

    	function onDeleteMenuPushed() {
    		$$invalidate(2, showDeleteConfirmation = true);
    	}

    	async function doDelete() {
    		await deleteIssue(issue.id);
    		push(`/issues`);
    	}

    	function deleteconfirmationdialog_visible_binding(value) {
    		showDeleteConfirmation = value;
    		$$invalidate(2, showDeleteConfirmation);
    	}

    	$$self.$$set = $$props => {
    		if ("issue" in $$props) $$invalidate(0, issue = $$props.issue);
    	};

    	return [
    		issue,
    		editing,
    		showDeleteConfirmation,
    		onEditMenuPushed,
    		onIssueSave,
    		onIssueCancel,
    		onDeleteMenuPushed,
    		doDelete,
    		deleteconfirmationdialog_visible_binding
    	];
    }

    class IssueView extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$b, create_fragment$c, safe_not_equal, { issue: 0 });
    	}
    }

    /* src/pages/issue_view/index.svelte generated by Svelte v3.24.1 */

    function create_else_block$2(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let p;
    	let t2;
    	let t3;
    	let t4;

    	return {
    		c() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Unkown Issue";
    			t1 = space();
    			p = element("p");
    			t2 = text("Issue:");
    			t3 = text(/*issueId*/ ctx[1]);
    			t4 = text(" does not exist.");
    			attr(div, "class", "card");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h1);
    			append(div, t1);
    			append(div, p);
    			append(p, t2);
    			append(p, t3);
    			append(p, t4);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*issueId*/ 2) set_data(t3, /*issueId*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (34:0) {#if issue}
    function create_if_block$5(ctx) {
    	let issueview;
    	let current;
    	issueview = new IssueView({ props: { issue: /*issue*/ ctx[0] } });

    	return {
    		c() {
    			create_component(issueview.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(issueview, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const issueview_changes = {};
    			if (dirty & /*issue*/ 1) issueview_changes.issue = /*issue*/ ctx[0];
    			issueview.$set(issueview_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(issueview.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(issueview.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(issueview, detaching);
    		}
    	};
    }

    function create_fragment$d(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$5, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*issue*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let $routeParams;
    	let $db;
    	let $socket;
    	let $project;
    	component_subscribe($$self, routeParams, $$value => $$invalidate(2, $routeParams = $$value));
    	component_subscribe($$self, db, $$value => $$invalidate(3, $db = $$value));
    	component_subscribe($$self, socket, $$value => $$invalidate(4, $socket = $$value));
    	component_subscribe($$self, project, $$value => $$invalidate(5, $project = $$value));
    	let issue = null;

    	async function refresh() {
    		$db.issues.mapToClass(Issue);
    		$$invalidate(0, issue = await $db.issues.get(issueId));
    		const titleTail = `@ ${$project.name} - Indie Tracker`;

    		if (issue) {
    			window.document.title = `[${issue.shorten_id}] ${issue.title} ${titleTail}`;
    		} else {
    			window.document.title = `Unknown issue ${titleTail}`;
    		}
    	}

    	let issueId;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$routeParams*/ 4) {
    			 $$invalidate(1, issueId = $routeParams.issueId);
    		}

    		if ($$self.$$.dirty & /*$db, issueId*/ 10) {
    			 if ($db && issueId) {
    				refresh();
    			}
    		}

    		if ($$self.$$.dirty & /*$socket, issueId*/ 18) {
    			 if ($socket && $socket.type === "issue" && $socket.data.id === issueId) {
    				refresh();
    			}
    		}
    	};

    	return [issue, issueId];
    }

    class Issue_view extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$c, create_fragment$d, safe_not_equal, {});
    	}
    }

    /* src/pages/issue_edit/index.svelte generated by Svelte v3.24.1 */

    function create_fragment$e(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let issueform;
    	let current;
    	issueform = new IssueForm({});
    	issueform.$on("save", /*onSave*/ ctx[0]);
    	issueform.$on("cancel", /*onCancel*/ ctx[1]);

    	return {
    		c() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "New Issue";
    			t1 = space();
    			create_component(issueform.$$.fragment);
    			attr(div, "class", "card issue-new");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h1);
    			append(div, t1);
    			mount_component(issueform, div, null);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(issueform.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(issueform.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(issueform);
    		}
    	};
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let $project;
    	let $socket;
    	component_subscribe($$self, project, $$value => $$invalidate(3, $project = $$value));
    	component_subscribe($$self, socket, $$value => $$invalidate(4, $socket = $$value));
    	let title = "";
    	

    	async function onSave(event) {
    		// XXX: keep title to specify saving issue
    		$$invalidate(2, title = event.detail.title);

    		try {
    			await addIssue(event.detail);
    		} catch(error) {
    			console.error(error);
    		}
    	}

    	function onCancel() {
    		push(`/issues`);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$project*/ 8) {
    			 if ($project) {
    				window.document.title = `Create issue ${$project.name} - Indie Tracker`;
    			}
    		}

    		if ($$self.$$.dirty & /*$socket, title*/ 20) {
    			 if ($socket && $socket.type === "issue" && $socket.data.title === title) {
    				// XXX: redirect to issue after created (..is there some better way?)
    				push(`/issues/${$socket.data.id}`);
    			}
    		}
    	};

    	return [onSave, onCancel];
    }

    class Issue_edit extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$d, create_fragment$e, safe_not_equal, {});
    	}
    }

    /* src/pages/not_found/index.svelte generated by Svelte v3.24.1 */

    function create_fragment$f(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "NotFount";
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    class Not_found extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$f, safe_not_equal, {});
    	}
    }

    /* src/pages/wiki/WikiPageForm.svelte generated by Svelte v3.24.1 */

    function create_default_slot_3$2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Cancel");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (47:2) <Button disabled={!previewEnabled} on:click={() => { showPreview = true }}>
    function create_default_slot_2$5(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Preview");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (48:2) <Button disabled={!saveEnabled} color="primary" on:click={onSaveButtonPushed}>
    function create_default_slot_1$6(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Save");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (51:4) <div slot="title"p>
    function create_title_slot$3(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "Preview";
    			attr(div, "slot", "title");
    			attr(div, "p", "");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (50:2) <Dialog width="500" bind:visible={showPreview}>
    function create_default_slot$8(ctx) {
    	let t;
    	let rstviewer;
    	let current;
    	rstviewer = new RstViewer({ props: { rst: /*body*/ ctx[1] } });

    	return {
    		c() {
    			t = space();
    			create_component(rstviewer.$$.fragment);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    			mount_component(rstviewer, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const rstviewer_changes = {};
    			if (dirty & /*body*/ 2) rstviewer_changes.rst = /*body*/ ctx[1];
    			rstviewer.$set(rstviewer_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(rstviewer.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(rstviewer.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    			destroy_component(rstviewer, detaching);
    		}
    	};
    }

    function create_fragment$g(ctx) {
    	let div;
    	let textfield;
    	let updating_value;
    	let t0;
    	let textarea;
    	let updating_value_1;
    	let t1;
    	let button0;
    	let t2;
    	let button1;
    	let t3;
    	let button2;
    	let t4;
    	let dialog;
    	let updating_visible;
    	let current;

    	function textfield_value_binding(value) {
    		/*textfield_value_binding*/ ctx[7].call(null, value);
    	}

    	let textfield_props = {
    		name: "path",
    		autocomplete: "off",
    		required: true,
    		label: "path",
    		message: ""
    	};

    	if (/*page_id*/ ctx[0] !== void 0) {
    		textfield_props.value = /*page_id*/ ctx[0];
    	}

    	textfield = new Ve({ props: textfield_props });
    	binding_callbacks.push(() => bind(textfield, "value", textfield_value_binding));

    	function textarea_value_binding(value) {
    		/*textarea_value_binding*/ ctx[8].call(null, value);
    	}

    	let textarea_props = {
    		name: "body",
    		required: true,
    		rows: Math.min(/*body*/ ctx[1].split("\n").length + 3, 50),
    		label: "body",
    		style: "font-family: monospace; font-size: 1em;"
    	};

    	if (/*body*/ ctx[1] !== void 0) {
    		textarea_props.value = /*body*/ ctx[1];
    	}

    	textarea = new TextArea({ props: textarea_props });
    	binding_callbacks.push(() => bind(textarea, "value", textarea_value_binding));

    	button0 = new ye({
    			props: {
    				$$slots: { default: [create_default_slot_3$2] },
    				$$scope: { ctx }
    			}
    		});

    	button0.$on("click", /*onCancelButtonPushed*/ ctx[6]);

    	button1 = new ye({
    			props: {
    				disabled: !/*previewEnabled*/ ctx[4],
    				$$slots: { default: [create_default_slot_2$5] },
    				$$scope: { ctx }
    			}
    		});

    	button1.$on("click", /*click_handler*/ ctx[9]);

    	button2 = new ye({
    			props: {
    				disabled: !/*saveEnabled*/ ctx[3],
    				color: "primary",
    				$$slots: { default: [create_default_slot_1$6] },
    				$$scope: { ctx }
    			}
    		});

    	button2.$on("click", /*onSaveButtonPushed*/ ctx[5]);

    	function dialog_visible_binding(value) {
    		/*dialog_visible_binding*/ ctx[10].call(null, value);
    	}

    	let dialog_props = {
    		width: "500",
    		$$slots: {
    			default: [create_default_slot$8],
    			title: [create_title_slot$3]
    		},
    		$$scope: { ctx }
    	};

    	if (/*showPreview*/ ctx[2] !== void 0) {
    		dialog_props.visible = /*showPreview*/ ctx[2];
    	}

    	dialog = new pn({ props: dialog_props });
    	binding_callbacks.push(() => bind(dialog, "visible", dialog_visible_binding));

    	return {
    		c() {
    			div = element("div");
    			create_component(textfield.$$.fragment);
    			t0 = space();
    			create_component(textarea.$$.fragment);
    			t1 = space();
    			create_component(button0.$$.fragment);
    			t2 = space();
    			create_component(button1.$$.fragment);
    			t3 = space();
    			create_component(button2.$$.fragment);
    			t4 = space();
    			create_component(dialog.$$.fragment);
    			attr(div, "class", "form");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(textfield, div, null);
    			append(div, t0);
    			mount_component(textarea, div, null);
    			append(div, t1);
    			mount_component(button0, div, null);
    			append(div, t2);
    			mount_component(button1, div, null);
    			append(div, t3);
    			mount_component(button2, div, null);
    			append(div, t4);
    			mount_component(dialog, div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const textfield_changes = {};

    			if (!updating_value && dirty & /*page_id*/ 1) {
    				updating_value = true;
    				textfield_changes.value = /*page_id*/ ctx[0];
    				add_flush_callback(() => updating_value = false);
    			}

    			textfield.$set(textfield_changes);
    			const textarea_changes = {};
    			if (dirty & /*body*/ 2) textarea_changes.rows = Math.min(/*body*/ ctx[1].split("\n").length + 3, 50);

    			if (!updating_value_1 && dirty & /*body*/ 2) {
    				updating_value_1 = true;
    				textarea_changes.value = /*body*/ ctx[1];
    				add_flush_callback(() => updating_value_1 = false);
    			}

    			textarea.$set(textarea_changes);
    			const button0_changes = {};

    			if (dirty & /*$$scope*/ 4096) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};
    			if (dirty & /*previewEnabled*/ 16) button1_changes.disabled = !/*previewEnabled*/ ctx[4];

    			if (dirty & /*$$scope*/ 4096) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    			const button2_changes = {};
    			if (dirty & /*saveEnabled*/ 8) button2_changes.disabled = !/*saveEnabled*/ ctx[3];

    			if (dirty & /*$$scope*/ 4096) {
    				button2_changes.$$scope = { dirty, ctx };
    			}

    			button2.$set(button2_changes);
    			const dialog_changes = {};

    			if (dirty & /*$$scope, body*/ 4098) {
    				dialog_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_visible && dirty & /*showPreview*/ 4) {
    				updating_visible = true;
    				dialog_changes.visible = /*showPreview*/ ctx[2];
    				add_flush_callback(() => updating_visible = false);
    			}

    			dialog.$set(dialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(textfield.$$.fragment, local);
    			transition_in(textarea.$$.fragment, local);
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			transition_in(button2.$$.fragment, local);
    			transition_in(dialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(textfield.$$.fragment, local);
    			transition_out(textarea.$$.fragment, local);
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			transition_out(button2.$$.fragment, local);
    			transition_out(dialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(textfield);
    			destroy_component(textarea);
    			destroy_component(button0);
    			destroy_component(button1);
    			destroy_component(button2);
    			destroy_component(dialog);
    		}
    	};
    }

    function instance$e($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { page_id = "" } = $$props;
    	let { body = "" } = $$props;
    	let showPreview = false;

    	async function onSaveButtonPushed() {
    		const data = await putWikiPage(page_id, { body });
    		dispatch("saved", data);
    	}

    	function onCancelButtonPushed() {
    		dispatch("cancel");
    	}

    	function textfield_value_binding(value) {
    		page_id = value;
    		$$invalidate(0, page_id);
    	}

    	function textarea_value_binding(value) {
    		body = value;
    		$$invalidate(1, body);
    	}

    	const click_handler = () => {
    		$$invalidate(2, showPreview = true);
    	};

    	function dialog_visible_binding(value) {
    		showPreview = value;
    		$$invalidate(2, showPreview);
    	}

    	$$self.$$set = $$props => {
    		if ("page_id" in $$props) $$invalidate(0, page_id = $$props.page_id);
    		if ("body" in $$props) $$invalidate(1, body = $$props.body);
    	};

    	let saveEnabled;
    	let previewEnabled;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*page_id, body*/ 3) {
    			 $$invalidate(3, saveEnabled = page_id !== "" && body !== "");
    		}

    		if ($$self.$$.dirty & /*body*/ 2) {
    			 $$invalidate(4, previewEnabled = body !== "");
    		}
    	};

    	return [
    		page_id,
    		body,
    		showPreview,
    		saveEnabled,
    		previewEnabled,
    		onSaveButtonPushed,
    		onCancelButtonPushed,
    		textfield_value_binding,
    		textarea_value_binding,
    		click_handler,
    		dialog_visible_binding
    	];
    }

    class WikiPageForm extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$e, create_fragment$g, safe_not_equal, { page_id: 0, body: 1 });
    	}
    }

    /**
     * Create breadCrumb list from path.
     */
    function makeBreadCrumbs(pageId) {
      if (pageId === "Home") {
        return [{ name: "Home" }];
      }

      const ret = [{ name: "wiki", link: "/wiki/" }];
      const arr = pageId.split("/");

      for (let i = 0; i < arr.length; i++) {
        const bc = { name: arr[i] };
        if (i < arr.length - 1) {
          bc.link = `${ret[i].link}${arr[i]}/`;
        }
        ret.push(bc);
      }
      return ret;
    }

    /* src/pages/wiki/BreadCrumb.svelte generated by Svelte v3.24.1 */

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	child_ctx[4] = i;
    	return child_ctx;
    }

    // (12:4) {#if 0 < i }
    function create_if_block_1$3(ctx) {
    	let span;

    	return {
    		c() {
    			span = element("span");
    			span.textContent = "/";
    			attr(span, "class", "separator svelte-4z3xvp");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (17:4) {:else}
    function create_else_block$3(ctx) {
    	let t_value = /*bs*/ ctx[2].name + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*breadCrumbs*/ 1 && t_value !== (t_value = /*bs*/ ctx[2].name + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (15:4) {#if bs.link }
    function create_if_block$6(ctx) {
    	let a;
    	let t_value = /*bs*/ ctx[2].name + "";
    	let t;
    	let a_href_value;
    	let link_action;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			a = element("a");
    			t = text(t_value);
    			attr(a, "href", a_href_value = /*bs*/ ctx[2].link);
    		},
    		m(target, anchor) {
    			insert(target, a, anchor);
    			append(a, t);

    			if (!mounted) {
    				dispose = action_destroyer(link_action = link.call(null, a));
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*breadCrumbs*/ 1 && t_value !== (t_value = /*bs*/ ctx[2].name + "")) set_data(t, t_value);

    			if (dirty & /*breadCrumbs*/ 1 && a_href_value !== (a_href_value = /*bs*/ ctx[2].link)) {
    				attr(a, "href", a_href_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(a);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (11:2) {#each breadCrumbs as bs, i}
    function create_each_block$3(ctx) {
    	let t;
    	let if_block1_anchor;
    	let if_block0 = 0 < /*i*/ ctx[4] && create_if_block_1$3();

    	function select_block_type(ctx, dirty) {
    		if (/*bs*/ ctx[2].link) return create_if_block$6;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);

    	return {
    		c() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if_block1.c();
    			if_block1_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t, anchor);
    			if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			}
    		},
    		d(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t);
    			if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    		}
    	};
    }

    function create_fragment$h(ctx) {
    	let div;
    	let each_value = /*breadCrumbs*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*breadCrumbs*/ 1) {
    				each_value = /*breadCrumbs*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function instance$f($$self, $$props, $$invalidate) {
    	let { pageId = "" } = $$props;

    	$$self.$$set = $$props => {
    		if ("pageId" in $$props) $$invalidate(1, pageId = $$props.pageId);
    	};

    	let breadCrumbs;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*pageId*/ 2) {
    			 $$invalidate(0, breadCrumbs = makeBreadCrumbs(pageId));
    		}
    	};

    	return [breadCrumbs, pageId];
    }

    class BreadCrumb extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$f, create_fragment$h, safe_not_equal, { pageId: 1 });
    	}
    }

    /* src/pages/wiki/index.svelte generated by Svelte v3.24.1 */

    function create_catch_block$1(ctx) {
    	return {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};
    }

    // (44:30)    {#if !editing && wikiPage.body}
    function create_then_block$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$7, create_if_block_1$4, create_else_block$4];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*editing*/ ctx[0] && /*wikiPage*/ ctx[1].body) return 0;
    		if (!/*editing*/ ctx[0]) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (65:2) {:else}
    function create_else_block$4(ctx) {
    	let wikipageform;
    	let current;
    	const wikipageform_spread_levels = [/*wikiPage*/ ctx[1]];
    	let wikipageform_props = {};

    	for (let i = 0; i < wikipageform_spread_levels.length; i += 1) {
    		wikipageform_props = assign(wikipageform_props, wikipageform_spread_levels[i]);
    	}

    	wikipageform = new WikiPageForm({ props: wikipageform_props });
    	wikipageform.$on("saved", /*onSaved*/ ctx[5]);
    	wikipageform.$on("cancel", /*onEditingCanceled*/ ctx[6]);

    	return {
    		c() {
    			create_component(wikipageform.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(wikipageform, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const wikipageform_changes = (dirty & /*wikiPage*/ 2)
    			? get_spread_update(wikipageform_spread_levels, [get_spread_object(/*wikiPage*/ ctx[1])])
    			: {};

    			wikipageform.$set(wikipageform_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(wikipageform.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(wikipageform.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(wikipageform, detaching);
    		}
    	};
    }

    // (57:21) 
    function create_if_block_1$4(ctx) {
    	let div;
    	let breadcrumb;
    	let t0;
    	let p;
    	let t1;
    	let button;
    	let current;

    	breadcrumb = new BreadCrumb({
    			props: { pageId: /*wikiPage*/ ctx[1].page_id }
    		});

    	button = new ye({
    			props: {
    				$$slots: { default: [create_default_slot_3$3] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*onEditPushed*/ ctx[4]);

    	return {
    		c() {
    			div = element("div");
    			create_component(breadcrumb.$$.fragment);
    			t0 = space();
    			p = element("p");
    			t1 = text("Page does not exist.\n      ");
    			create_component(button.$$.fragment);
    			attr(div, "class", "flex-align-top");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(breadcrumb, div, null);
    			insert(target, t0, anchor);
    			insert(target, p, anchor);
    			append(p, t1);
    			mount_component(button, p, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const breadcrumb_changes = {};
    			if (dirty & /*wikiPage*/ 2) breadcrumb_changes.pageId = /*wikiPage*/ ctx[1].page_id;
    			breadcrumb.$set(breadcrumb_changes);
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 8192) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(breadcrumb.$$.fragment, local);
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(breadcrumb.$$.fragment, local);
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(breadcrumb);
    			if (detaching) detach(t0);
    			if (detaching) detach(p);
    			destroy_component(button);
    		}
    	};
    }

    // (45:2) {#if !editing && wikiPage.body}
    function create_if_block$7(ctx) {
    	let div;
    	let breadcrumb;
    	let t0;
    	let menu;
    	let t1;
    	let rstviewer;
    	let current;

    	breadcrumb = new BreadCrumb({
    			props: { pageId: /*wikiPage*/ ctx[1].page_id }
    		});

    	menu = new kn({
    			props: {
    				origin: "top right",
    				$$slots: {
    					default: [create_default_slot$9],
    					activator: [create_activator_slot$2]
    				},
    				$$scope: { ctx }
    			}
    		});

    	rstviewer = new RstViewer({ props: { rst: /*wikiPage*/ ctx[1].body } });

    	return {
    		c() {
    			div = element("div");
    			create_component(breadcrumb.$$.fragment);
    			t0 = space();
    			create_component(menu.$$.fragment);
    			t1 = space();
    			create_component(rstviewer.$$.fragment);
    			attr(div, "class", "flex-align-top");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(breadcrumb, div, null);
    			append(div, t0);
    			mount_component(menu, div, null);
    			insert(target, t1, anchor);
    			mount_component(rstviewer, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const breadcrumb_changes = {};
    			if (dirty & /*wikiPage*/ 2) breadcrumb_changes.pageId = /*wikiPage*/ ctx[1].page_id;
    			breadcrumb.$set(breadcrumb_changes);
    			const menu_changes = {};

    			if (dirty & /*$$scope*/ 8192) {
    				menu_changes.$$scope = { dirty, ctx };
    			}

    			menu.$set(menu_changes);
    			const rstviewer_changes = {};
    			if (dirty & /*wikiPage*/ 2) rstviewer_changes.rst = /*wikiPage*/ ctx[1].body;
    			rstviewer.$set(rstviewer_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(breadcrumb.$$.fragment, local);
    			transition_in(menu.$$.fragment, local);
    			transition_in(rstviewer.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(breadcrumb.$$.fragment, local);
    			transition_out(menu.$$.fragment, local);
    			transition_out(rstviewer.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(breadcrumb);
    			destroy_component(menu);
    			if (detaching) detach(t1);
    			destroy_component(rstviewer, detaching);
    		}
    	};
    }

    // (63:6) <Button on:click={onEditPushed}>
    function create_default_slot_3$3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Create");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (49:8) <div slot="activator">
    function create_activator_slot$2(ctx) {
    	let div;
    	let menubutton;
    	let current;
    	menubutton = new MenuButton({});

    	return {
    		c() {
    			div = element("div");
    			create_component(menubutton.$$.fragment);
    			attr(div, "slot", "activator");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(menubutton, div, null);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(menubutton.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(menubutton.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(menubutton);
    		}
    	};
    }

    // (52:8) <Menuitem on:click={onEditPushed}>
    function create_default_slot_2$6(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Edit");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (53:8) <Menuitem style="color: var(--danger);" on:click={onDeletePushed}>
    function create_default_slot_1$7(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Deletef");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (48:6) <Menu origin="top right">
    function create_default_slot$9(ctx) {
    	let t0;
    	let menuitem0;
    	let t1;
    	let menuitem1;
    	let current;

    	menuitem0 = new jn({
    			props: {
    				$$slots: { default: [create_default_slot_2$6] },
    				$$scope: { ctx }
    			}
    		});

    	menuitem0.$on("click", /*onEditPushed*/ ctx[4]);

    	menuitem1 = new jn({
    			props: {
    				style: "color: var(--danger);",
    				$$slots: { default: [create_default_slot_1$7] },
    				$$scope: { ctx }
    			}
    		});

    	menuitem1.$on("click", /*onDeletePushed*/ ctx[7]);

    	return {
    		c() {
    			t0 = space();
    			create_component(menuitem0.$$.fragment);
    			t1 = space();
    			create_component(menuitem1.$$.fragment);
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			mount_component(menuitem0, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(menuitem1, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const menuitem0_changes = {};

    			if (dirty & /*$$scope*/ 8192) {
    				menuitem0_changes.$$scope = { dirty, ctx };
    			}

    			menuitem0.$set(menuitem0_changes);
    			const menuitem1_changes = {};

    			if (dirty & /*$$scope*/ 8192) {
    				menuitem1_changes.$$scope = { dirty, ctx };
    			}

    			menuitem1.$set(menuitem1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(menuitem0.$$.fragment, local);
    			transition_in(menuitem1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(menuitem0.$$.fragment, local);
    			transition_out(menuitem1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			destroy_component(menuitem0, detaching);
    			if (detaching) detach(t1);
    			destroy_component(menuitem1, detaching);
    		}
    	};
    }

    // (1:0) <script>   import { createEventDispatcher }
    function create_pending_block$1(ctx) {
    	return {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};
    }

    function create_fragment$i(ctx) {
    	let div;
    	let promise;
    	let t;
    	let deleteconfirmationdialog;
    	let updating_visible;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block$1,
    		then: create_then_block$1,
    		catch: create_catch_block$1,
    		value: 12,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*refreshPromise*/ ctx[3], info);

    	function deleteconfirmationdialog_visible_binding(value) {
    		/*deleteconfirmationdialog_visible_binding*/ ctx[9].call(null, value);
    	}

    	let deleteconfirmationdialog_props = {
    		message: "Delete the wiki '" + (/*wikiPage*/ ctx[1] ? /*wikiPage*/ ctx[1].page_id : "") + "' ?"
    	};

    	if (/*showDeleteConfirmation*/ ctx[2] !== void 0) {
    		deleteconfirmationdialog_props.visible = /*showDeleteConfirmation*/ ctx[2];
    	}

    	deleteconfirmationdialog = new DeleteConfirmationDialog({ props: deleteconfirmationdialog_props });
    	binding_callbacks.push(() => bind(deleteconfirmationdialog, "visible", deleteconfirmationdialog_visible_binding));
    	deleteconfirmationdialog.$on("do-delete", /*doDelete*/ ctx[8]);

    	return {
    		c() {
    			div = element("div");
    			info.block.c();
    			t = space();
    			create_component(deleteconfirmationdialog.$$.fragment);
    			attr(div, "class", "WikiPage card");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			info.block.m(div, info.anchor = null);
    			info.mount = () => div;
    			info.anchor = t;
    			append(div, t);
    			mount_component(deleteconfirmationdialog, div, null);
    			current = true;
    		},
    		p(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*refreshPromise*/ 8 && promise !== (promise = /*refreshPromise*/ ctx[3]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[12] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			const deleteconfirmationdialog_changes = {};
    			if (dirty & /*wikiPage*/ 2) deleteconfirmationdialog_changes.message = "Delete the wiki '" + (/*wikiPage*/ ctx[1] ? /*wikiPage*/ ctx[1].page_id : "") + "' ?";

    			if (!updating_visible && dirty & /*showDeleteConfirmation*/ 4) {
    				updating_visible = true;
    				deleteconfirmationdialog_changes.visible = /*showDeleteConfirmation*/ ctx[2];
    				add_flush_callback(() => updating_visible = false);
    			}

    			deleteconfirmationdialog.$set(deleteconfirmationdialog_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(info.block);
    			transition_in(deleteconfirmationdialog.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			transition_out(deleteconfirmationdialog.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			info.block.d();
    			info.token = null;
    			info = null;
    			destroy_component(deleteconfirmationdialog);
    		}
    	};
    }

    function instance$g($$self, $$props, $$invalidate) {
    	let $routeParams;
    	component_subscribe($$self, routeParams, $$value => $$invalidate(10, $routeParams = $$value));
    	let editing = false;
    	let wikiPage = null;
    	let showDeleteConfirmation = false;

    	async function refresh(pageId) {
    		$$invalidate(0, editing = false);
    		$$invalidate(1, wikiPage = await getWikiPage(pageId));
    	}

    	function onEditPushed() {
    		$$invalidate(0, editing = true);
    	}

    	function onSaved(event) {
    		$$invalidate(0, editing = false);
    		$$invalidate(1, wikiPage = event.detail);
    	}

    	function onEditingCanceled() {
    		$$invalidate(0, editing = false);
    	}

    	function onDeletePushed() {
    		$$invalidate(2, showDeleteConfirmation = true);
    	}

    	async function doDelete() {
    		$$invalidate(1, wikiPage = await deleteWikiPage(wikiPage.page_id));
    	}

    	function deleteconfirmationdialog_visible_binding(value) {
    		showDeleteConfirmation = value;
    		$$invalidate(2, showDeleteConfirmation);
    	}

    	let refreshPromise;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$routeParams*/ 1024) {
    			 $$invalidate(3, refreshPromise = refresh($routeParams.pageId));
    		}
    	};

    	return [
    		editing,
    		wikiPage,
    		showDeleteConfirmation,
    		refreshPromise,
    		onEditPushed,
    		onSaved,
    		onEditingCanceled,
    		onDeletePushed,
    		doDelete,
    		deleteconfirmationdialog_visible_binding
    	];
    }

    class Wiki extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$g, create_fragment$i, safe_not_equal, {});
    	}
    }

    var routes = [
      { path: "/", component: Issue_list },
      { path: "/issues", component: Issue_list },
      { path: "/issues/new", component: Issue_edit },
      { path: "/issues/(?<issueId>[0-9a-f-]+)", component: Issue_view },
      { path: "/wiki/(?<pageId>.*)", component: Wiki },
      { path: ".*", component: Not_found },
    ];

    /* src/App.svelte generated by Svelte v3.24.1 */

    function create_if_block$8(ctx) {
    	let div1;

    	return {
    		c() {
    			div1 = element("div");
    			div1.innerHTML = `<div class="quicklink"></div>`;
    			attr(div1, "class", "sidebar svelte-1m70k5e");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    		}
    	};
    }

    function create_fragment$j(ctx) {
    	let div1;
    	let header;
    	let t0;
    	let main;
    	let t1;
    	let div0;
    	let router;
    	let t2;
    	let footer;
    	let current;
    	header = new Header({});
    	let if_block = /*showSideBar*/ ctx[0] && create_if_block$8();
    	router = new Router({ props: { routes } });

    	return {
    		c() {
    			div1 = element("div");
    			create_component(header.$$.fragment);
    			t0 = space();
    			main = element("main");
    			if (if_block) if_block.c();
    			t1 = space();
    			div0 = element("div");
    			create_component(router.$$.fragment);
    			t2 = space();
    			footer = element("footer");
    			footer.innerHTML = `<a href="https://github.com/ykrods/indie-tracker" target="_blank">Indie Tracker</a>`;
    			attr(div0, "class", "main svelte-1m70k5e");
    			attr(main, "class", "svelte-1m70k5e");
    			attr(footer, "class", "svelte-1m70k5e");
    			attr(div1, "class", "app");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			mount_component(header, div1, null);
    			append(div1, t0);
    			append(div1, main);
    			if (if_block) if_block.m(main, null);
    			append(main, t1);
    			append(main, div0);
    			mount_component(router, div0, null);
    			append(div1, t2);
    			append(div1, footer);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*showSideBar*/ ctx[0]) {
    				if (if_block) ; else {
    					if_block = create_if_block$8();
    					if_block.c();
    					if_block.m(main, t1);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			destroy_component(header);
    			if (if_block) if_block.d();
    			destroy_component(router);
    		}
    	};
    }

    function instance$h($$self, $$props, $$invalidate) {
    	let $project;
    	let $db;
    	component_subscribe($$self, project, $$value => $$invalidate(1, $project = $$value));
    	component_subscribe($$self, db, $$value => $$invalidate(2, $db = $$value));
    	let { showSideBar = false } = $$props;

    	onMount(async () => {
    		project.set(await getProject());
    		db.set(projectDB($project));
    		socket.open($project, $db);
    	});

    	$$self.$$set = $$props => {
    		if ("showSideBar" in $$props) $$invalidate(0, showSideBar = $$props.showSideBar);
    	};

    	return [showSideBar];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$h, create_fragment$j, safe_not_equal, { showSideBar: 0 });
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
