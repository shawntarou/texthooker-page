//The text inserter/scroller and the counter begin here.

//These are needed later.
const CHARS_TO_IGNORE = "「」『』[]()〈〉≪≫。、.,'：！?！？…――─ｰ～→♪" + '"' + "　" + "  "
let lines = { total: 0 }
let chars = { total: 0 }
let history = [];
let expanded = false;
const selection = document.querySelector('#local-storage');
const fontSizeInput = document.querySelector('#font-size-input');

// Change font size when value changes
fontSizeInput.addEventListener('change', (e) => {
    localStorage.setItem('font-size', e.target.value);
    document.documentElement.style.fontSize = e.target.value;
})

//This function is invoked when a node(line) is inserted.
let callback = function (mutations) {

    //Confirm that a new line (a <p> tag) was inserted.
    mutations.forEach((mutation) => {
        if (mutation.target == document.body &&
            mutation.type == 'childList' &&
            mutation.addedNodes.length >= 1) {
            let ptag
            mutation.addedNodes.forEach((node) => {
                if (node.tagName == 'P') {
                    ptag = node
                }
            })
            if (!ptag) return
            //Found the inserted line.

            //Wrap the inserted text in a div and append a "remove line" button.
            let text = ptag.textContent
            ptag.remove()
            let div = document.createElement('div')
            div.classList.add('line_box')
            div.innerHTML = '<span></span><div class="remove_button"></div>'
            div.getElementsByTagName('span')[0].textContent = text

            if (!isNaN(mutation.index)) {
                const lines = Array.from(document.querySelectorAll('.line_box'));

                div.classList.add('undoed_line');
                const nextSibling = lines[mutation.index];
                (nextSibling?.parentNode || document.body)
                    .insertBefore(div, nextSibling);
                div.scrollIntoView();

                // Add to local storage
                if (mutation.source !== 'localStorage' && selection.value === 'text') {
                    updateLocalStorage('text', pr => {
                        let dates = pr.dates;

                        let isDatePresent = false;
                        const newItem = { date: mutation.date, index: mutation.index };

                        dates = dates.reduce((pr, cur) => {
                            const diff = new Date(mutation.date) - new Date(cur.date);

                            if (diff === 0) {
                                isDatePresent = true;
                            } else if (diff < 0) {
                                cur.index++;

                                if (!isDatePresent) {
                                    isDatePresent = true;

                                    return [
                                        ...pr,
                                        newItem,
                                        cur,
                                    ];
                                }
                            }

                            return [
                                ...pr,
                                cur,
                            ];
                        }, []);

                        if (!isDatePresent) {
                            dates.push(newItem);
                        }

                        return {
                            text: [
                                ...pr.text.slice(0, mutation.index),
                                ptag.textContent,
                                ...pr.text.slice(mutation.index)
                            ],
                            dates
                        };
                    });
                }
            } else {
                document.body.appendChild(div)

                // Add to local storage
                if (mutation.source !== 'localStorage' && selection.value === 'text') {
                    const curDate = formatDate();

                    updateLocalStorage('text', pr => ({
                        text: [...pr.text, ptag.textContent],
                        dates: (pr.dates[pr.dates.length - 1]?.date === curDate) ?
                            pr.dates :
                            [...pr.dates, { date: curDate, index: [...pr.text].length }]
                    }));
                }

                //The text-scroller is below.
                //I've included it in the "new line" function (we are in it now).
                //(That is, it won't run unless a new line was added.)

                var LEEWAY = 200; // Amount of "leeway" pixels before latching onto the bottom.

                // Some obscene browser shit because making sense is for dweebs
                var b = document.body;
                var offset = b.scrollHeight - b.offsetHeight;
                var scrollPos = (b.scrollTop + offset);
                var scrollBottom = (b.scrollHeight - (b.clientHeight + offset));

                // If we are at the bottom, go to the bottom again.
                if (scrollPos >= scrollBottom - LEEWAY) {
                    window.scrollTo(0, document.body.scrollHeight);
                }
            }

            //Update the counter.
            line = text

            line = line.replace(/(\r\n|\n|\r)/gm, "").split(' ').join('');
            for (var i = 0; i < CHARS_TO_IGNORE.length; i++) {
                line = line.split(CHARS_TO_IGNORE[i]).join('')
            }

            let lineLen = [...line].length
            updateCounter(lineLen, 1, mutation.date || formatDate());
        }
    })
}
// End of new line and scroller script.

//Register the above new line callback function.
let observer = new MutationObserver(callback)
let observerOptions = { childList: true, attributes: false }
observer.observe(document.body, observerOptions)


//Beginning of "remove line" function.

function delet(xdiv) {

    //Get the length of the line being removed.
    let line = xdiv.parentNode.getElementsByTagName('span')[0].textContent

    let filteredLine = line.replace(/(\r\n|\n|\r)/gm, "").split(' ').join('');
    for (var i = 0; i < CHARS_TO_IGNORE.length; i++) {
        filteredLine = filteredLine.split(CHARS_TO_IGNORE[i]).join('')
    }

    let lineLen = [...filteredLine].length

    // Remove line from localStorage
    const lines = Array.from(document.querySelectorAll('.remove_button'));
    const index = lines.findIndex(a => a === xdiv);

    let dateOfLine = null;
    if (index > -1) {
        if (selection.value === 'text') {
            updateLocalStorage('text', pr => {
                let dates = pr.dates;

                dates = dates.reduce((pr, cur, i) => {
                    if (cur.index <= index) {
                        dateOfLine = cur.date;
                    }

                    if (cur.index === index &&
                        (dates[i + 1]?.index - 1 === cur.index || lines.length - 1 === cur.index)
                    ) {
                        return pr;
                    }

                    if (cur.index > index) {
                        cur.index--;
                    }

                    return [
                        ...pr,
                        cur,
                    ];
                }, []);

                return {
                    text: [
                        ...pr.text.slice(0, index),
                        ...pr.text.slice(index + 1)
                    ],
                    dates
                };
            });
        }

        // Used in the next if
        const getNewHistory = pr => {
            if (pr.length >= 25) {
                pr.shift();
            }

            return [
                ...pr,
                {
                    text: line,
                    date: dateOfLine,
                    index
                }
            ];
        };

        if (selection.value !== 'text') {
            history = getNewHistory(history);
        } else {
            updateLocalStorage('history', getNewHistory);
        }
    }

    //Remove the line.
    xdiv.parentNode.remove()

    //Update the counter.
    updateCounter(-lineLen, -1, dateOfLine);
}
//End of "remove line" function.

//Function to update the char and line counter.
function updateCounter(charDiff, lineDiff, date, shouldDisplay = true) {
    chars.total += charDiff;
    chars[date] = (chars[date] ?? 0) + charDiff;
    lines.total += lineDiff;
    lines[date] = (lines[date] ?? 0) + lineDiff;

    if (shouldDisplay) {
        displayCounter();
    }

    if (selection.value === 'chars') {
        updateLocalStorage('chars', _ => ({ chars, lines }));
    }
}

function deleteLastLine() {
    var lines = document.getElementsByClassName('line_box');
    var line_count = lines.length;

    if (line_count > 0) {
        var last_line = lines[line_count - 1].getElementsByClassName("remove_button")[0];
        delet(last_line);
    }
};

function initFromLocalStorage() {
    // Set font size
    const fontSize = localStorage.getItem('font-size');
    document.documentElement.style.fontSize = fontSize;
    fontSizeInput.value = fontSize;

    selection.value = localStorage.getItem('valueInLS');

    switch (selection.value) {
        case 'text':
            const text = JSON.parse(localStorage.getItem('text'));
            const reverseDates = text.dates.reverse();

            let fragment = document.createDocumentFragment();

            for (let i = 0; i < text.text.length; i++) {
                let div = document.createElement('div')
                div.classList.add('line_box')
                div.innerHTML = '<span></span><div class="remove_button"></div>'
                div.getElementsByTagName('span')[0].textContent = text.text[i];

                fragment.appendChild(div);
            };
            document.body.appendChild(fragment)

            text.text.forEach((a, i) => {
                a = a.replace(/(\r\n|\n|\r)/gm, "").split(' ').join('');
                for (var j = 0; j < CHARS_TO_IGNORE.length; j++) {
                    a = a.split(CHARS_TO_IGNORE[j]).join('')
                }

                let lineLen = [...a].length
                updateCounter(
                    lineLen,
                    1,
                    reverseDates.find(b => b.index <= i)?.date || text.dates[0].date,
                    false
                );
            });

            displayCounter();

            break;
        case 'chars':
            const charsInLS = JSON.parse(localStorage.getItem('chars'));
            chars = charsInLS.chars;
            lines = charsInLS.lines;

            displayCounter();
            break;
    }
}

function displayCounter() {
    let charsdisp = chars.total.toLocaleString()
    let linesdisp = lines.total.toLocaleString()

    document.getElementById('counter').textContent = charsdisp + ' / ' + linesdisp

    const formattedDatetoLocaleString = (date) => {
        return new Date(date.split('/').reverse()).toLocaleDateString();
    }

    document.querySelector('#detailed-counter').innerHTML = Object.keys(chars)
        .filter(a => a !== 'total' && chars[a] !== 0)
        .map(key => `<div>
          <span>
            ${formattedDatetoLocaleString(key)}: 
          </span> ${chars[key].toLocaleString()} / ${lines[key].toLocaleString()}
        </div>`)
        .join('');
}

function updateLocalStorage(key, fn) {
    localStorage.setItem(key, JSON.stringify(
        fn(
            JSON.parse(
                localStorage.getItem(key)
            )
        )
    ));
}

function clearEverything() {
    updateLocalStorage('text', _ => ({ text: [], dates: [] }));
    updateLocalStorage('chars', _ => ({ lines: { total: 0 }, dates: { total: 0 } }));
    updateLocalStorage('history', _ => []);

    document.querySelectorAll('.line_box').forEach(a =>
        a.parentNode.removeChild(a));

    lines = { total: 0 };
    chars = { total: 0 };
    history = [];
    displayCounter();
}

function formatDate(date = new Date()) {
    // 4 hour offset
    const offset = 4 * 3600 * 1000;
    date = new Date(date - offset);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function undoDeletion() {
    let line;

    if (selection.value !== 'text') {
        line = history.pop();
    } else {
        line = JSON.parse(localStorage.getItem('history')).pop();
        updateLocalStorage('history', pr => pr.slice(0, pr.length - 1));
    }

    if (line) {
        callback(
            [{
                index: line.index,
                date: line.date,
                target: document.body,
                type: 'childList',
                addedNodes: [
                    {
                        tagName: 'P',
                        textContent: line.text,
                        remove: () => null
                    }
                ]
            }]
        );

    }
}

function expandCounter() {
    if (expanded) {
        document.querySelector('#detailed-counter').style.display = 'none';
    } else {
        document.querySelector('#detailed-counter').style.display = 'block';
    }

    expanded = !expanded;
}

// Initialize localStorage
if (!localStorage.getItem('text')) {
    updateLocalStorage('text', _ => ({ text: [], dates: [] }));
}

// Backwards compatibility
updateLocalStorage('text', pr => {
    if (pr?.constructor === Array) {
        const yesterday = new Date(new Date() - 24 * 3600 * 1000);

        return {
            text: pr,
            dates: pr.length > 0 ? [{ date: formatDate(yesterday), index: 0 }] : []
        }
    }

    return pr;
})

if (!localStorage.getItem('history')) {
    localStorage.setItem('history', '[]');
}

if (!localStorage.getItem('chars')) {
    updateLocalStorage('chars', _ => ({ chars: { total: 0 }, lines: { total: 0 } }));
}

if (!localStorage.getItem('valueInLS')) {
    localStorage.setItem('valueInLS', 'text');
}

if (!localStorage.getItem('font-size')) {
    localStorage.setItem('font-size', 26);
}

initFromLocalStorage();

document.addEventListener('keydown', e => {
    if (e.code === 'KeyZ' && e.ctrlKey) {
        undoDeletion();
    }
})

selection.addEventListener('change', e => {
    // If changed from chars to something else and data has been lost
    const isFromChars =
        JSON.parse(localStorage.getItem('chars')).lines.total >
        document.querySelectorAll('.line_box').length;
    const question = "This action will reset your stats and clear the page. Are you sure you want to procceed?";

    switch (selection.value) {
        case 'nothing':
            if (isFromChars) {
                const answer = confirm(question);

                if (answer) {
                    clearEverything();
                } else {
                    break;
                }
            } else {
                updateLocalStorage('text', _ => ({ text: [], dates: [] }));
                updateLocalStorage('chars', _ => ({ lines: { total: 0 }, chars: { total: 0 } }));

                if (localStorage.getItem('history').length > 0) {
                    history = JSON.parse(localStorage.getItem('history'));
                    updateLocalStorage('history', _ => []);
                }
            }
            break;
        case 'chars':
            updateLocalStorage('text', _ => ({ text: [], dates: [] }));
            updateLocalStorage('chars', _ => ({ lines, chars }));

            if (localStorage.getItem('history').length > 0) {
                history = JSON.parse(localStorage.getItem('history'));
                updateLocalStorage('history', _ => []);
            }
            break;
        case 'text':
            if (isFromChars) {
                const answer = confirm(question);

                if (answer) {
                    clearEverything();
                } else {
                    break;
                }
            } else {
                let prIndex = 0;

                updateLocalStorage('text', _ => ({
                    text: Array.from(document.querySelectorAll('.line_box > span')).map(a => a.textContent),
                    dates: Object.keys(lines).filter(a => a !== 'total').map(key => {
                        prIndex += lines[key];
                        return { date: key, index: prIndex - lines[key] };
                    })
                }));

                updateLocalStorage('chars', _ => ({ lines: { total: 0 }, chars: { total: 0 } }));

                updateLocalStorage('history', _ => history);
                history = [];
            }
            break;
    }

    localStorage.setItem('valueInLS', selection.value);
})