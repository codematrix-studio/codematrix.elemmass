/* CodeMatrix Elemmass admin interface — Vanilla JavaScript. */
(function(window, document) {
    'use strict';

    var checkTimeout = null;
    var checkTimeoutDelay = 0;
    var processController = null;

    window.WdaStop = false;
    window.WdaCurrentAction = false;
    window.WdaProcessRequest = false;
    window.WdaCanSubmit = true;
    window.WdaPageLoaded = false;

    function byId(id) {
        return document.getElementById(id);
    }

    function query(selector, root) {
        return (root || document).querySelector(selector);
    }

    function queryAll(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function dispatch(element, type) {
        if (element) {
            element.dispatchEvent(new Event(type, { bubbles: true }));
        }
    }

    function setHTML(element, html) {
        if (!element) return;
        element.innerHTML = html;
        queryAll('script', element).forEach(function(oldScript) {
            var type = (oldScript.getAttribute('type') || '').trim();
            if (type && !/^(?:text|application)\/(?:java|ecma)script$|^module$/i.test(type)) return;
            var script = document.createElement('script');
            Array.prototype.forEach.call(oldScript.attributes, function(attribute) {
                script.setAttribute(attribute.name, attribute.value);
            });
            if (!script.src) script.textContent = oldScript.textContent;
            else script.async = false;
            oldScript.parentNode.replaceChild(script, oldScript);
        });
    }

    function serializeForm(form) {
        if (!form) return '';
        var pairs = [];
        Array.prototype.forEach.call(form.elements, function(field) {
            if (!field.name || field.disabled) return;
            var type = (field.type || '').toLowerCase();
            if (['submit', 'button', 'image', 'reset', 'file'].indexOf(type) !== -1) return;
            if ((type === 'checkbox' || type === 'radio') && !field.checked) return;
            if (field.tagName === 'SELECT' && field.multiple) {
                Array.prototype.forEach.call(field.options, function(option) {
                    if (option.selected && !option.disabled) {
                        pairs.push(encodeURIComponent(field.name) + '=' + encodeURIComponent(option.value.replace(/\r?\n/g, '\r\n')));
                    }
                });
                return;
            }
            pairs.push(encodeURIComponent(field.name) + '=' + encodeURIComponent(String(field.value).replace(/\r?\n/g, '\r\n')));
        });
        return pairs.join('&');
    }

    function appendQuery(url, data) {
        if (!data) return url;
        return url + (url.indexOf('?') === -1 ? '?' : '&') + data;
    }

    function requestText(url, options) {
        options = options || {};
        options.credentials = options.credentials || 'same-origin';
        options.headers = Object.assign({ 'X-Requested-With': 'XMLHttpRequest' }, options.headers || {});
        return fetch(url, options).then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.text();
        });
    }

    function requestJson(url, options) {
        options = options || {};
        options.credentials = options.credentials || 'same-origin';
        options.headers = Object.assign({ 'X-Requested-With': 'XMLHttpRequest' }, options.headers || {});
        return fetch(url, options).then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        });
    }

    function postOptions(data, signal) {
        var options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
            body: data,
            credentials: 'same-origin'
        };
        if (signal) options.signal = signal;
        return options;
    }

    function getOptionByValue(select, value) {
        return Array.prototype.find.call(select.options, function(option) {
            return option.value === String(value);
        }) || null;
    }

    function WDA_Deserialize(root, dataRaw) {
        if (!root) return root;
        var params = new URLSearchParams(dataRaw || '');
        queryAll('input:not([type="hidden"]):not([type="image"]):not([type="button"]):not([type="submit"]):not([type="radio"]):not([type="checkbox"]), textarea, select', root).forEach(function(field) {
            field.value = '';
        });
        queryAll('input[type="checkbox"], input[type="radio"]', root).forEach(function(field) {
            field.checked = false;
        });

        params.forEach(function(value, name) {
            var fields = Array.prototype.filter.call(root.elements || [], function(field) {
                return field.name === name && !['image', 'button', 'submit'].includes((field.type || '').toLowerCase());
            });
            if (!fields.length) {
                fields = queryAll('[name]', root).filter(function(field) { return field.name === name; });
            }
            if (fields.length === 1 && fields[0].type !== 'radio') {
                var field = fields[0];
                if (field.type === 'checkbox') {
                    field.checked = field.value === value || (!field.hasAttribute('value') && value.toUpperCase() === 'ON');
                } else {
                    field.value = value;
                }
            } else if (fields.length === 2 && fields[0].type === 'hidden' && fields[1].type === 'checkbox') {
                fields[1].checked = fields[1].value === value || (!fields[1].hasAttribute('value') && value.toUpperCase() === 'ON');
            } else if (fields.length === 2 && fields[0].tagName === 'SELECT' && fields[1].type === 'hidden') {
                fields[1].value = value;
            } else if (fields.length && fields.every(function(field) { return field.type === 'radio'; })) {
                fields.forEach(function(field) { field.checked = field.value === value; });
            } else if (fields.length === 1) {
                fields[0].value = value;
            }
        });
        return root;
    }

    function Log() {}

    function WDA_ShowMessage(title, message, type) {
        var container = byId('wda_message');
        if (!container) return;
        container.innerHTML = '';
        if (title === false || !message) return;

        var wrap = document.createElement('div');
        wrap.className = 'adm-info-message-wrap adm-info-message-' + (type === 'ERROR' ? 'red' : 'green');
        var body = document.createElement('div');
        body.className = 'adm-info-message';
        var heading = document.createElement('div');
        heading.className = 'adm-info-message-title';
        var bold = document.createElement('b');
        bold.textContent = title;
        heading.appendChild(bold);
        var content = document.createElement('div');
        content.innerHTML = message;
        var icon = document.createElement('div');
        icon.className = 'adm-info-message-icon';
        body.appendChild(heading);
        body.appendChild(content);
        body.appendChild(icon);
        wrap.appendChild(body);
        container.appendChild(wrap);
    }

    function WDA_SetCheckboxValue(checkbox, value) {
        var field = typeof checkbox === 'string' ? query(checkbox) : checkbox;
        if (!field) return;
        field.checked = value === 'Y' || value === true || value === 'true';
    }

    function WDA_StrRepeat(input, multiplier) {
        return new Array(Math.max(0, multiplier) + 1).join(String(input));
    }

    function WDA_FilterRevision(iblockId) {
        var filterContainer = byId('wda_filters');
        var parameterSelect = byId('wda_filter_param');
        if (!filterContainer) return;
        queryAll('.item', filterContainer).forEach(function(item) {
            var codeField = query('.f_p2', item);
            var code = codeField ? codeField.value : '';
            var exists = parameterSelect && Array.prototype.some.call(parameterSelect.options, function(option) {
                return option.value === code;
            });
            var noIBlock = iblockId === false || iblockId === null || iblockId === '' || parseInt(iblockId, 10) <= 0;
            if (noIBlock || (code.length > 0 && !exists)) item.remove();
        });
        if (!query('.item', filterContainer)) {
            var empty = byId('filter_no_filters');
            if (empty) empty.style.display = '';
        }
        WDA_StartCheckTimeout();
    }

    function WDA_OnChangeIBlockID(select, callback) {
        if (typeof select === 'string') select = byId(select);
        if (!select) return;
        var iblockId = select.value;
        Log('onWdaBeforeIBlockChange');
        BX.onCustomEvent('onWdaBeforeIBlockChange', [select, iblockId]);

        if (parseInt(iblockId, 10) > 0) {
            WDA_SetAdminUrl(WDA_GetCurPageParam('IBLOCK_ID=' + encodeURIComponent(iblockId), ['IBLOCK_ID']));
            var url = WDA.Url + '?lang=' + encodeURIComponent(WDA.Lang) + '&change_iblock=Y&iblock_id=' + encodeURIComponent(iblockId);
            requestJson(url, { method: 'GET' }).then(function(data) {
                var sections = byId('wda_select_sections');
                if (sections) {
                    queryAll('option:not([value=""])', sections).forEach(function(option) { option.remove(); });
                    (data.SECTIONS || []).forEach(function(section) {
                        var option = new Option(WDA_StrRepeat('\u00a0\u00a0\u00a0\u00a0', Number(section.DEPTH_LEVEL) - 1) + '[' + section.ID + '] ' + section.NAME, section.ID);
                        sections.add(option);
                    });
                    sections.value = '';
                }

                var fields = byId('wda_filter_param');
                if (fields) {
                    var emptyOption = fields.querySelector('option[value=""]') || new Option('', '');
                    fields.innerHTML = '';
                    fields.add(emptyOption);
                    var grouped = {};
                    Object.keys(data.FILTER_FIELDS || {}).forEach(function(key) {
                        var field = data.FILTER_FIELDS[key];
                        var option = new Option(field.WDA_NAME_FULL, field.WDA_CODE);
                        option.setAttribute('data-name', field.WDA_NAME);
                        option.setAttribute('data-type', field.WDA_TYPE);
                        option.setAttribute('data-group', field.WDA_GROUP);
                        var groupCode = field.WDA_GROUP || '';
                        if (groupCode) {
                            if (!grouped[groupCode]) grouped[groupCode] = [];
                            grouped[groupCode].push(option);
                        } else {
                            fields.add(option);
                        }
                    });
                    Object.keys(grouped).sort(function(left, right) {
                        var leftSort = parseInt((data.GROUPS[left] || {}).SORT, 10);
                        var rightSort = parseInt((data.GROUPS[right] || {}).SORT, 10);
                        if (isNaN(leftSort)) leftSort = 0;
                        if (isNaN(rightSort)) rightSort = 0;
                        return leftSort - rightSort;
                    }).forEach(function(code) {
                        var groupData = data.GROUPS[code] || {};
                        var group = document.createElement('optgroup');
                        group.label = groupData.NAME || code;
                        group.setAttribute('data-group', code);
                        group.setAttribute('data-sort', groupData.SORT || 0);
                        grouped[code].forEach(function(option) { group.appendChild(option); });
                        fields.appendChild(group);
                    });
                    var firstGroup = fields.querySelector('optgroup');
                    if (firstGroup) fields.insertBefore(emptyOption, firstGroup);
                    else fields.insertBefore(emptyOption, fields.firstChild);
                    var actionSelect = byId('wda_select_action');
                    dispatch(actionSelect, 'change');
                }

                WDA_FilterRevision(iblockId);
                WDA_StartCheckTimeout();
                Log('onWdaAfterIBlockChange');
                BX.onCustomEvent('onWdaAfterIBlockChange', [select, iblockId]);
                if (typeof callback === 'function') callback(select, iblockId);
            }).catch(function(error) {
                console.error('CodeMatrix Elemmass: failed to load infoblock data', error);
            });
        } else {
            var filterFields = byId('wda_filter_param');
            if (filterFields) queryAll('optgroup', filterFields).forEach(function(group) { group.remove(); });
            var action = byId('wda_select_action');
            if (action) {
                action.value = '';
                dispatch(action, 'change');
            }
            var sectionSelect = byId('wda_select_sections');
            if (sectionSelect) queryAll('option:not([value=""])', sectionSelect).forEach(function(option) { option.remove(); });
            WDA_FilterRevision(false);
        }
    }

    function WDA_OnChangeAction(select, callback) {
        if (!select) return;
        WDA_DisableControls();
        window.WdaCurrentAction = select.value;
        Log('onWdaBeforeActionChange');
        BX.onCustomEvent('onWdaBeforeActionChange');
        if (window.WdaCurrentAction === '') {
            WDA_EnableControls();
            return;
        }

        WDA_SetAdminUrl(WDA_GetCurPageParam('ACTION=' + encodeURIComponent(window.WdaCurrentAction), ['ACTION']));
        var params = byId('wda_action_params');
        if (params) {
            params.classList.add('loading');
            params.innerHTML = '';
        }
        var formData = serializeForm(byId('wda_form'));
        var url = WDA.Url + '?lang=' + encodeURIComponent(WDA.Lang) + '&show_action_settings=Y&action=' + encodeURIComponent(window.WdaCurrentAction);
        requestText(appendQuery(url, formData), { method: 'GET' }).then(function(html) {
            if (params) {
                setHTML(params, html);
                queryAll('input[type="checkbox"]', params).forEach(function(checkbox) {
                    if (BX.adminFormTools && BX.adminFormTools.modifyCheckbox) BX.adminFormTools.modifyCheckbox(checkbox);
                });
            }
            Log('onWdaAfterActionChange');
            BX.onCustomEvent('onWdaAfterActionChange');
            if (typeof callback === 'function') callback(select, window.WdaCurrentAction);
            if (params) params.classList.remove('loading');
            WDA_EnableControls();
        }).catch(function(error) {
            if (params) params.classList.remove('loading');
            WDA_EnableControls();
            console.error('CodeMatrix Elemmass: failed to load action settings', error);
        });
    }

    function WDA_AddFilter(data) {
        var filters = byId('wda_filters');
        if (!filters) return;
        var item = document.createElement('div');
        item.className = 'item';
        item.title = WDA.Messages.FilterItemTitle;

        function addValue(className, label, fields) {
            var span = document.createElement('span');
            span.className = className;
            span.appendChild(document.createTextNode(String(label == null ? '' : label)));
            fields.forEach(function(field) {
                var input = document.createElement('input');
                input.type = 'hidden';
                input.name = field[0];
                input.className = field[1];
                input.value = String(field[2] == null ? '' : field[2]);
                span.appendChild(input);
            });
            item.appendChild(span);
        }

        var value1 = String(data[4] == null ? '' : data[4]).replace(/&([a-z]+);/i, '{html_$1}');
        var value2 = String(data[5] == null ? '' : data[5]).replace(/&([a-z]+);/i, '{html_$1}');
        addValue('param', data[0], [['f_p1[]', 'f_p1', data[0]], ['f_p2[]', 'f_p2', data[1]]]);
        item.appendChild(document.createTextNode(' '));
        addValue('equal', data[2], [['f_e1[]', 'f_e1', data[2]], ['f_e2[]', 'f_e2', data[3]]]);
        item.appendChild(document.createTextNode(' '));
        addValue('value', value1.replace(/\{html_([a-z]+)\}/, '&$1;'), [['f_v1[]', 'f_v1', value1], ['f_v2[]', 'f_v2', value2]]);
        var empty = byId('filter_no_filters');
        if (empty) empty.style.display = 'none';
        filters.appendChild(item);
        WDA_StartCheckTimeout();
    }

    function WDA_DisableControls() {
        var button = byId('wda_submit');
        if (button) {
            button.disabled = true;
            button.classList.remove('adm-btn-green');
        }
    }

    function WDA_EnableControls() {
        var button = byId('wda_submit');
        if (button) {
            button.disabled = false;
            button.classList.add('adm-btn-green');
        }
    }

    function WDA_ShowCancelButton() {
        var button = byId('wda_cancel');
        if (button) {
            button.hidden = false;
            button.style.display = 'inline-block';
            button.classList.remove('disabled');
            button.disabled = false;
        }
    }

    function WDA_HideCancelButton() {
        var button = byId('wda_cancel');
        if (button) {
            button.hidden = true;
            button.style.display = 'none';
        }
    }

    function WDA_CheckFilterResults() {
        var status = byId('filter_check_status');
        if (status) {
            status.innerHTML = '';
            status.classList.add('loading');
        }
        WDA_DisableControls();
        requestJson(WDA.Url + '?lang=' + encodeURIComponent(WDA.Lang) + '&check_filter_results=Y', postOptions(serializeForm(byId('wda_form')))).then(function(data) {
            if (status) {
                status.innerHTML = '';
                var resultCount = Number(data.count);
                if (resultCount > 0 || resultCount === 0) {
                    var indicator = document.createElement('div');
                    indicator.className = data.count > 0 ? 'full' : 'none';
                    indicator.title = data.count;
                    indicator.textContent = data.count_approximately;
                    status.appendChild(indicator);
                }
                status.classList.remove('loading');
            }
            WDA_EnableControls();
        }).catch(function(error) {
            if (status) status.classList.remove('loading');
            WDA_EnableControls();
            console.error('CodeMatrix Elemmass: failed to check filter', error);
        });
    }

    function WDA_StartCheckTimeout() {
        if (checkTimeoutDelay > 0) {
            window.clearTimeout(checkTimeout);
            checkTimeout = window.setTimeout(WDA_CheckFilterResults, checkTimeoutDelay);
        }
    }

    function WDA_LoadPropertyEnums(propertyId) {
        var select = byId('wda_filter_value_list');
        var iblock = byId('wda_select_iblock');
        if (!select || !iblock) return;
        select.disabled = true;
        select.classList.add('disabled');
        if (parseInt(iblock.value, 10) <= 0) return;

        var url = WDA.Url + '?lang=' + encodeURIComponent(WDA.Lang) + '&load_property_enums=Y&iblock_id=' + encodeURIComponent(iblock.value) + '&property_id=' + encodeURIComponent(propertyId);
        requestJson(url, postOptions('')).then(function(data) {
            select.innerHTML = '';
            Object.keys(data.ITEMS || {}).forEach(function(key) {
                var item = data.ITEMS[key];
                var option = new Option(item.VALUE, item.ID);
                option.setAttribute('data-name', item.VALUE);
                select.add(option);
            });
            select.disabled = false;
            select.classList.remove('disabled');
        }).catch(function(error) {
            select.disabled = false;
            select.classList.remove('disabled');
            console.error('CodeMatrix Elemmass: failed to load property values', error);
        });
    }

    function WDA_LoadTextType() {
        var select = byId('wda_filter_value_list');
        if (!select) return;
        select.innerHTML = '';
        select.add(new Option('text', 'text'));
        select.add(new Option('html', 'html'));
        select.options[0].setAttribute('data-name', 'text');
        select.options[1].setAttribute('data-name', 'html');
    }

    function WDA_Submit() {
        window.WdaCanSubmit = true;
        Log('onWdaBeforeSubmit');
        BX.onCustomEvent('onWdaBeforeSubmit');
        if (window.WdaCanSubmit !== true) return;
        WDA_ShowMessage(false);
        var iblock = byId('wda_select_iblock');
        if (iblock && iblock.value !== '') {
            WDA_StartAction();
        } else {
            WDA_ShowMessage(WDA.Messages.IBlockNotSelectedTitle, WDA.Messages.IBlockNotSelectedMessage, 'ERROR');
        }
    }

    function WDA_Process(start) {
        var startValue = start === true ? 'Y' : 'N';
        window.WdaStop = false;
        WDA_ShowProgressBar();
        WDA_ShowCancelButton();
        if (processController) processController.abort();
        processController = new AbortController();
        window.WdaProcessRequest = processController;
        var url = WDA.Url + '?lang=' + encodeURIComponent(WDA.Lang) + '&process=Y&start=' + startValue;
        requestJson(url, postOptions(serializeForm(byId('wda_form')), processController.signal)).then(function(data) {
            window.WdaProcessRequest = false;
            processController = null;
            if (data === null || typeof data !== 'object') {
                WDA_ActionError(1);
            } else if (window.WdaStop) {
                WDA_EnableControls();
                WDA_HideProgressBar();
                WDA_HideCancelButton();
            } else if (data.done === true) {
                WDA_EndAction(data.count, data.succeed, data.failed);
            } else if (data.next === true) {
                WDA_ContinueAction(data.index, data.count);
            } else {
                WDA_ActionError(2);
            }
        }).catch(function(error) {
            window.WdaProcessRequest = false;
            processController = null;
            if (error.name === 'AbortError' && window.WdaStop) {
                WDA_EnableControls();
                WDA_HideProgressBar();
                WDA_HideCancelButton();
                return;
            }
            WDA_ActionError(3);
        });
    }

    function WDA_StartAction() {
        WDA_DisableControls();
        WDA_Process(true);
    }

    function WDA_ContinueAction(index, count) {
        WDA_SetProgressBarPosition(index, count);
        window.setTimeout(function() {
            if (!window.WdaStop) WDA_Process(false);
        }, Number(WDA.StepPause) * 1000);
    }

    function WDA_EndAction(count, succeed, failed) {
        WDA_EnableControls();
        WDA_HideCancelButton();
        WDA_HideProgressBar();
        var title = WDA.Messages.SuccessTitle.replace('#1#', count).replace('#2#', succeed).replace('#3#', failed);
        var message = WDA.Messages.SuccessMessage.replace('#1#', count).replace('#2#', succeed).replace('#3#', failed);
        WDA_ShowMessage(title, message);
    }

    function WDA_ActionError() {
        WDA_EnableControls();
        WDA_HideCancelButton();
        WDA_HideProgressBar();
        WDA_ShowMessage(WDA.Messages.ErrorTitle, WDA.Messages.ErrorMessage, 'ERROR');
    }

    function WDA_ShowProgressBar() {
        var progress = byId('wda_progressbar');
        if (progress) progress.style.display = 'inline-block';
    }

    function WDA_HideProgressBar() {
        var progress = byId('wda_progressbar');
        if (progress) {
            progress.style.display = 'none';
            var bar = query('.wda_bar', progress);
            var text = query('.wda_text', progress);
            if (bar) bar.style.width = '0%';
            if (text) text.textContent = '';
        }
        WDA_HideCancelButton();
    }

    function WDA_SetProgressBarPosition(index, count) {
        var percent = Number(index) * 100 / Number(count);
        if (!isFinite(percent)) percent = 0;
        percent = Math.round(percent);
        var progress = byId('wda_progressbar');
        if (!progress) return;
        var bar = query('.wda_bar', progress);
        var text = query('.wda_text', progress);
        if (bar) bar.style.width = percent + '%';
        if (text) text.textContent = index + ' / ' + count;
    }

    function WDA_SetAdminUrl(url) {
        if (window.WdaPageLoaded) window.history.pushState('', '', url);
    }

    function WDA_GetCurPageParam(paramsToAdd, keysToRemove) {
        var url = new URL(window.location.href.split('#')[0]);
        (keysToRemove || []).forEach(function(key) { url.searchParams.delete(key); });
        if (paramsToAdd) {
            new URLSearchParams(paramsToAdd).forEach(function(value, key) {
                url.searchParams.set(key, value);
            });
        }
        return url.pathname + (url.search ? url.search : '');
    }

    function WDA_LoadProfile(profileId) {
        var profile = window['WdaProfile' + profileId];
        if (!profile || typeof profile !== 'object') return;
        var iblock = byId('wda_select_iblock');
        if (!iblock) return;
        iblock.value = profile.IBLOCK_ID;
        var settings = byId('wda_settigns_edit_table');
        if (settings) window.scrollTo({ top: settings.getBoundingClientRect().top + window.pageYOffset - 50, behavior: 'smooth' });

        WDA_OnChangeIBlockID(iblock, function() {
            var sections = byId('wda_select_sections');
            if (sections) {
                var selectedSections = String(profile.SECTIONS_ID || '').split(',');
                Array.prototype.forEach.call(sections.options, function(option) {
                    option.selected = selectedSections.indexOf(option.value) !== -1;
                });
            }
            WDA_SetCheckboxValue(byId('wda_include_subsections'), profile.WITH_SUBSECTIONS === 'Y');

            var filters = String(profile.FILTER || '').split('&');
            var values = {};
            var indexes = {};
            filters.forEach(function(filter) {
                var match = filter.match(/^f_([epv])([12])\[(\d+)\]=(.*?)$/);
                if (!match) return;
                var key = match[1] + match[2];
                if (!values[key]) values[key] = [];
                values[key][match[3]] = match[4];
                indexes[match[3]] = true;
            });
            Object.keys(indexes).forEach(function(index) {
                WDA_AddFilter([
                    decodeURIComponent(values.p1[index] || ''),
                    decodeURIComponent(values.p2[index] || ''),
                    decodeURIComponent(values.e1[index] || ''),
                    decodeURIComponent(values.e2[index] || ''),
                    decodeURIComponent(values.v1[index] || ''),
                    decodeURIComponent(values.v2[index] || '')
                ]);
            });

            window.WdaProfileData = profile;
            var action = byId('wda_select_action');
            if (!action) return;
            action.value = profile.ACTION;
            WDA_OnChangeAction(action, function() {
                var paramsRoot = byId('wda_action_params');
                if (!paramsRoot) return;
                WDA_Deserialize(paramsRoot, profile['~PARAMS']);
                queryAll('input[type="checkbox"], input[type="text"], input[type="radio"], select', paramsRoot).forEach(function(field) {
                    dispatch(field, 'change');
                    dispatch(field, 'input');
                });
                function callbackEventHandler() {
                    WDA_Deserialize(paramsRoot, profile['~PARAMS']);
                    queryAll('input[type="checkbox"], input[type="text"], input[type="radio"], select', paramsRoot).forEach(function(field) {
                        if (field.getAttribute('data-callback') !== 'wda_field_callback') {
                            dispatch(field, 'change');
                            dispatch(field, 'input');
                        }
                    });
                    BX.removeCustomEvent(window, 'wda_field_callback', callbackEventHandler);
                }
                BX.addCustomEvent(window, 'wda_field_callback', callbackEventHandler);
                var updateFunction = window['WDA_Params_Update_' + profile.ACTION];
                if (typeof updateFunction === 'function') updateFunction.call();
            });
        });
    }

    function initialize() {
        if (window.WdaPageLoaded) return;
        document.addEventListener('keydown', function(event) {
            if (event.altKey && event.key.toUpperCase() === 'X') WDA_Submit();
        });

        var sections = byId('wda_select_sections');
        if (sections) sections.addEventListener('change', function() {
            Log('onWdaSectionChange');
            BX.onCustomEvent('onWdaSectionChange', [sections]);
            WDA_StartCheckTimeout();
        });

        var subsections = byId('wda_include_subsections');
        if (subsections) subsections.addEventListener('change', WDA_StartCheckTimeout);

        var form = byId('wda_form');
        if (form) form.addEventListener('submit', function(event) { event.preventDefault(); });

        var iblock = byId('wda_select_iblock');
        if (iblock) iblock.addEventListener('change', function() { WDA_OnChangeIBlockID(this); });

        var filters = byId('wda_filters');
        if (filters) filters.addEventListener('click', function(event) {
            var item = event.target.closest('.item');
            if (!item || !filters.contains(item)) return;
            item.remove();
            if (!query('.item', filters)) {
                var empty = byId('filter_no_filters');
                if (empty) empty.style.display = '';
            }
            WDA_StartCheckTimeout();
        });

        var filterParam = byId('wda_filter_param');
        if (filterParam) filterParam.addEventListener('change', function() {
            var selected = filterParam.options[filterParam.selectedIndex];
            var propType = selected ? selected.getAttribute('data-type') : null;
            var equal = byId('wda_filter_equal');
            if (!equal) return;
            var equalValue = equal.value;
            queryAll('option:not([value=""])', equal).forEach(function(option) { option.remove(); });

            if (propType !== null && propType !== undefined) {
                var propCode = filterParam.value;
                propType = String(propType || '').toUpperCase();
                var parts = propType.split(':');
                var propTypeFull = parts[0] + (parts[1] === undefined ? '' : ':' + parts[1]);
                var propTypeShort = parts[0];
                var comparisonTypes = {};
                var allComparisonTypes = window.WdaComparisonTypes || {};
                if (parts.length === 2 && allComparisonTypes[propTypeFull] !== undefined) {
                    comparisonTypes = allComparisonTypes[propTypeFull];
                } else if (allComparisonTypes[propTypeShort] !== undefined) {
                    comparisonTypes = allComparisonTypes[propTypeShort];
                }

                var valueWrap = byId('wda_filter_value');
                var valueList = byId('wda_filter_value_list');
                var valueText = byId('wda_filter_value_text');
                if (propTypeShort === 'L') {
                    if (valueWrap) valueWrap.setAttribute('data-type', 'list');
                    if (valueList) valueList.style.display = '';
                    if (valueText) valueText.style.display = 'none';
                    var propertyMatch = propCode.match(/PROPERTY_(\d+)/i);
                    var propertyId = propertyMatch ? parseInt(propertyMatch[1], 10) : 0;
                    if (propertyId > 0) WDA_LoadPropertyEnums(propertyId);
                } else if (propTypeShort === 'T') {
                    if (valueWrap) valueWrap.setAttribute('data-type', 'list');
                    if (valueList) valueList.style.display = '';
                    if (valueText) valueText.style.display = 'none';
                    if (/_TEXT_TYPE/i.test(propCode)) WDA_LoadTextType();
                } else {
                    if (valueWrap) valueWrap.setAttribute('data-type', 'text');
                    if (valueList) valueList.style.display = 'none';
                    if (valueText) valueText.style.display = '';
                }

                var calendar = query('#wda_filter_value .calendar-icon');
                if (calendar) calendar.style.display = propTypeFull === 'S:DATETIME' ? '' : 'none';
                if (valueText) {
                    if (propTypeFull === 'N:INT') {
                        valueText.removeAttribute('data-float');
                        valueText.setAttribute('data-int', 'Y');
                    } else if (propTypeFull === 'N' || propTypeFull === 'P') {
                        valueText.removeAttribute('data-int');
                        valueText.setAttribute('data-float', 'Y');
                    } else {
                        valueText.removeAttribute('data-int');
                        valueText.removeAttribute('data-float');
                    }
                    valueText.value = '';
                }
                if (valueList) valueList.value = '';
                Object.keys(comparisonTypes).forEach(function(key) {
                    var item = comparisonTypes[key];
                    var option = new Option(item.NAME, key);
                    option.setAttribute('data-value', item.VALUE);
                    equal.add(option);
                });
                equal.value = equalValue;
                dispatch(equal, 'change');
            } else {
                queryAll('option:not([value=""])', equal).forEach(function(option) { option.remove(); });
            }
        });

        var filterEqual = byId('wda_filter_equal');
        if (filterEqual) filterEqual.addEventListener('change', function() {
            var selected = filterEqual.options[filterEqual.selectedIndex];
            var showValue = selected && selected.getAttribute('data-value') === 'Y';
            var value = byId('wda_filter_value');
            if (value) value.style.display = showValue ? '' : 'none';
        });

        var filterValue = byId('wda_filter_value');
        if (filterValue) filterValue.addEventListener('keydown', function(event) {
            if (event.target.matches('input') && event.key === 'Enter') {
                event.preventDefault();
                var addButton = byId('wda_filter_add_button');
                if (addButton) addButton.click();
            }
        });

        if (form) form.addEventListener('keypress', function(event) {
            if (!event.target.matches('input[type="text"]')) return;
            var keyCode = event.which || event.keyCode;
            var key = String.fromCharCode(keyCode);
            var regex = null;
            if (event.target.getAttribute('data-int') === 'Y') regex = /[0-9]/;
            else if (event.target.getAttribute('data-float') === 'Y') regex = /[0-9]|\./;
            if ((regex && !regex.test(key)) || (key === '.' && event.target.value.indexOf('.') > -1)) {
                event.preventDefault();
            }
        });

        queryAll('#wda_filter_add input[type="button"]').forEach(function(button) {
            button.addEventListener('click', function() {
                var param = byId('wda_filter_param');
                var equal = byId('wda_filter_equal');
                var valueText = byId('wda_filter_value_text');
                var valueList = byId('wda_filter_value_list');
                var valueWrap = byId('wda_filter_value');
                if (!param || !equal || !valueWrap || !valueText || !valueList) return;
                var paramOption = param.options[param.selectedIndex];
                var equalOption = equal.options[equal.selectedIndex];
                var valueOption = valueList.options[valueList.selectedIndex];
                var valueType = valueWrap.getAttribute('data-type');
                var value1 = valueType === 'list' ? (valueOption ? valueOption.getAttribute('data-name') : '') : valueText.value;
                var value2 = valueType === 'list' ? valueList.value : valueText.value;
                var showValue = equalOption && equalOption.getAttribute('data-value') === 'Y';
                if (!param.value || !equal.value) return false;
                if (showValue && String(value1 || '').trim() === '') return false;
                WDA_AddFilter([
                    paramOption ? paramOption.getAttribute('data-name') : '',
                    param.value,
                    equalOption ? equalOption.textContent : '',
                    equal.value,
                    value1 || '',
                    value2 || ''
                ]);
                valueText.value = '';
                valueWrap.style.display = 'none';
                equal.value = '';
                param.value = '';
                dispatch(param, 'change');
            });
        });

        var submit = byId('wda_submit');
        if (submit) submit.addEventListener('click', WDA_Submit);

        var action = byId('wda_select_action');
        if (action) action.addEventListener('change', function() { WDA_OnChangeAction(this); });

        var refresh = byId('wda_select_action_refresh');
        if (refresh) refresh.addEventListener('click', function() { dispatch(action, 'change'); });

        if (form) form.addEventListener('click', function(event) {
            if (!event.target.closest('#wda_cancel')) return;
            var cancel = event.target.closest('#wda_cancel');
            cancel.classList.add('disabled');
            cancel.disabled = true;
            window.WdaStop = true;
            if (processController) processController.abort();
        });

        WDA_StartCheckTimeout();
        if (iblock && iblock.value !== '') dispatch(iblock, 'change');
        else if (action && action.value !== '') dispatch(action, 'change');

        checkTimeoutDelay = 150;
        window.WdaPageLoaded = true;

        var saveProfile = byId('wda_save_profile');
        if (saveProfile) saveProfile.addEventListener('click', function() {
            var errors = [];
            var iblockValue = iblock ? iblock.value : '';
            var actionValue = action ? action.value : '';
            if (!iblockValue) errors.push(WDA.Messages.ProfileSaveErrorEmptyIBlock);
            else if (!actionValue) errors.push(WDA.Messages.ProfileSaveErrorEmptyAction);
            if (errors.length) {
                alert(errors.join('\n'));
                return;
            }
            var profileName = prompt(WDA.Messages.ProfileSavePrompt, WDA.Messages.ProfileSavePromptDefaultName);
            if (profileName === null || profileName.length === 0) return;
            if (profileName.length > 255) profileName = profileName.substring(0, 255);
            var data = serializeForm(form) + '&profile_name=' + encodeURIComponent(profileName.trim());
            var url = WDA.Url + '?lang=' + encodeURIComponent(WDA.Lang) + '&save_profile=Y';
            requestText(url, postOptions(data)).then(function() {}).catch(function(error) {
                console.error('CodeMatrix Elemmass: failed to save profile', error);
            });
        });
    }

    var publicApi = {
        CWDA_SetHTML: setHTML,
        WDA_ActionError: WDA_ActionError,
        WDA_AddFilter: WDA_AddFilter,
        WDA_CheckFilterResults: WDA_CheckFilterResults,
        WDA_ContinueAction: WDA_ContinueAction,
        WDA_Deserialize: WDA_Deserialize,
        WDA_DisableControls: WDA_DisableControls,
        WDA_EnableControls: WDA_EnableControls,
        WDA_EndAction: WDA_EndAction,
        WDA_FilterRevision: WDA_FilterRevision,
        WDA_GetCurPageParam: WDA_GetCurPageParam,
        WDA_HideCancelButton: WDA_HideCancelButton,
        WDA_HideProgressBar: WDA_HideProgressBar,
        WDA_LoadProfile: WDA_LoadProfile,
        WDA_LoadPropertyEnums: WDA_LoadPropertyEnums,
        WDA_LoadTextType: WDA_LoadTextType,
        WDA_OnChangeAction: WDA_OnChangeAction,
        WDA_OnChangeIBlockID: WDA_OnChangeIBlockID,
        WDA_Process: WDA_Process,
        WDA_SetAdminUrl: WDA_SetAdminUrl,
        WDA_SetCheckboxValue: WDA_SetCheckboxValue,
        WDA_SetProgressBarPosition: WDA_SetProgressBarPosition,
        WDA_ShowCancelButton: WDA_ShowCancelButton,
        WDA_ShowMessage: WDA_ShowMessage,
        WDA_ShowProgressBar: WDA_ShowProgressBar,
        WDA_StartAction: WDA_StartAction,
        WDA_StartCheckTimeout: WDA_StartCheckTimeout,
        WDA_StrRepeat: WDA_StrRepeat,
        WDA_Submit: WDA_Submit
    };
    Object.keys(publicApi).forEach(function(name) { window[name] = publicApi[name]; });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})(window, document);
