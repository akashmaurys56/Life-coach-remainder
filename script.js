(function() {
    // ---------- i18n strings (hinglish + english) ----------
    const lang = {
        en: {
            greet: "Hello",
            dark: "Dark",
            light: "Light",
            hindi: "हिंदी",
            english: "EN",
            profile: "Profile",
            dashboard: "Dashboard",
            newReminder: "New Reminder",
            allReminders: "All Reminders",
            save: "Save Reminder",
            voice: "🎤",
            // can extend
        },
        hi: {
            greet: "नमस्ते",
            dark: "डार्क",
            light: "लाइट",
            hindi: "हिंदी",
            english: "EN",
            profile: "प्रोफाइल",
            dashboard: "डैशबोर्ड",
            newReminder: "नया रिमाइंडर",
            allReminders: "सभी रिमाइंडर",
            save: "रिमाइंडर सेव करें",
            voice: "🎤",
        }
    };
    let currentLang = 'hi'; // default hinglish

    // ---------- current user ----------
    let currentUser = {
        name: 'अतिथि',
        role: 'student',
        family: ['मम्मी', 'पापा']  // default
    };

    let reminders = [];
    let pendingEditId = null; // for edit

    // ---------- load / init ----------
    function loadUser() {
        const stored = localStorage.getItem('lifeCoach_user');
        if (stored) {
            try { currentUser = JSON.parse(stored); } catch(e){}
        } else {
            // default user
            currentUser = { name: 'राहुल', role: 'student', family: ['मम्मी', 'पापा', 'अनु'] };
        }
        if (!currentUser.family) currentUser.family = [];
    }
    function saveUser() {
        localStorage.setItem('lifeCoach_user', JSON.stringify(currentUser));
    }

    function loadReminders() {
        const stored = localStorage.getItem('lifeCoach_reminders');
        if (stored) {
            try { reminders = JSON.parse(stored); } catch(e){ reminders = []; }
        } else {
            reminders = [];
        }
        // migrate: ensure nextDue field if missing
        reminders.forEach(r => {
            if (!r.nextDue && r.startDatetime) {
                r.nextDue = new Date(r.startDatetime).getTime();
            }
            if (r.completed === undefined) r.completed = false;
        });
    }
    function saveReminders() {
        localStorage.setItem('lifeCoach_reminders', JSON.stringify(reminders));
    }

    // ---------- helpers ----------
    function getIconForCategory(cat) {
        if (cat === 'health') return '💧';
        if (cat === 'study') return '📚';
        if (cat === 'home') return '🏠';
        if (cat === 'family') return '👪';
        return '🔔';
    }

    // render dashboard
    function renderDashboard() {
        const now = new Date();
        const todayStr = now.toISOString().slice(0,10);
        const todayReminders = reminders.filter(r => {
            if (r.completed) return false;
            const d = new Date(r.startDatetime);
            return d.toISOString().slice(0,10) === todayStr;
        }).sort((a,b)=>new Date(a.startDatetime)-new Date(b.startDatetime));

        let html = '';
        if (todayReminders.length===0) html = '<p>✅ आज के लिए कोई रिमाइंडर नहीं</p>';
        else {
            todayReminders.forEach(r => {
                html += `<div class="reminder-item">
                    <span class="reminder-icon">${getIconForCategory(r.category)}</span>
                    <div class="reminder-info">
                        <div class="reminder-title">${r.name} <span class="chip">${r.forWhom || 'खुद'}</span></div>
                        <div class="reminder-meta">${new Date(r.startDatetime).toLocaleString()} • ${r.repeat!=='none'?'🔄'+r.repeat:''}</div>
                    </div>
                </div>`;
            });
        }
        document.getElementById('todayRemindersList').innerHTML = html;

        // category counts
        let health=0, study=0, home=0, family=0, other=0;
        reminders.filter(r=>!r.completed).forEach(r => {
            if (r.category==='health') health++;
            else if (r.category==='study') study++;
            else if (r.category==='home') home++;
            else if (r.category==='family') family++;
            else other++;
        });
        document.getElementById('categoryCounts').innerHTML = `
            <span>💧 हेल्थ: ${health}</span> <span>📚 पढ़ाई: ${study}</span> <span>🏠 घर: ${home}</span> <span>👪 फैमिली: ${family}</span> <span>🔔 अन्य: ${other}</span>
        `;
        document.getElementById('todayCount').innerText = `(${todayReminders.length})`;
    }

    // render all reminders list with filters
    function renderAllReminders() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const catFilter = document.getElementById('categoryFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        let filtered = reminders.filter(r => {
            if (statusFilter==='pending' && r.completed) return false;
            if (statusFilter==='completed' && !r.completed) return false;
            if (catFilter!=='all' && r.category !== catFilter) return false;
            if (search && !r.name.toLowerCase().includes(search) && !(r.message||'').toLowerCase().includes(search)) return false;
            return true;
        }).sort((a,b)=> (a.completed === b.completed)?0: a.completed?1:-1);

        let html = '';
        if (filtered.length===0) html = '<p>कोई रिमाइंडर नहीं</p>';
        else {
            filtered.forEach(r => {
                const dateStr = new Date(r.startDatetime).toLocaleString();
                const statusEmoji = r.completed ? '✅' : '⏳';
                html += `<div class="reminder-item">
                    <span class="reminder-icon">${getIconForCategory(r.category)}</span>
                    <div class="reminder-info">
                        <div class="reminder-title">${r.name} ${statusEmoji} <span class="chip">${r.forWhom || 'खुद'}</span></div>
                        <div class="reminder-meta">${dateStr} • ${r.repeat} • ${r.message || ''}</div>
                    </div>
                    <div class="reminder-actions">
                        <button onclick="editReminder('${r.id}')">✏️</button>
                        <button onclick="deleteReminder('${r.id}')">🗑️</button>
                        <button onclick="toggleComplete('${r.id}')">✔️</button>
                    </div>
                </div>`;
            });
        }
        document.getElementById('allRemindersList').innerHTML = html;
    }

    // update family dropdown in form
    function updateForWhomDropdown() {
        const select = document.getElementById('reminderForWhom');
        select.innerHTML = '';
        const opts = ['खुद', ...(currentUser.family || [])];
        opts.forEach(o => {
            const option = document.createElement('option');
            option.value = o;
            option.textContent = o;
            select.appendChild(option);
        });
    }

    // ---------- notification permission ----------
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }

    // reminder check loop (every 30 seconds)
    function checkDueReminders() {
        const now = Date.now();
        reminders.forEach(r => {
            if (r.completed && r.repeat==='none') return;
            if (!r.nextDue) return;
            if (now >= r.nextDue) {
                // show notification
                if (Notification.permission === 'granted') {
                    new Notification(r.name, {
                        body: r.message || 'याद दिलाना है',
                        icon: '🔔'
                    });
                } else {
                    alert('🔔 ' + r.name + ' - ' + (r.message||''));
                }
                // handle repeat
                if (r.repeat === 'none') {
                    r.completed = true;
                    r.nextDue = null;
                } else {
                    // compute next
                    const next = new Date(r.nextDue);
                    if (r.repeat === 'daily') next.setDate(next.getDate() + 1);
                    else if (r.repeat === 'hourly') next.setHours(next.getHours() + 1);
                    else if (r.repeat === 'weekly') next.setDate(next.getDate() + 7);
                    r.nextDue = next.getTime();
                }
                saveReminders();
            }
        });
    }

    // window reminder interval
    setInterval(() => { checkDueReminders(); renderDashboard(); renderAllReminders(); }, 30000);

    // ---------- save new reminder ----------
    document.getElementById('saveReminderBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const name = document.getElementById('reminderName').value;
        const datetime = document.getElementById('reminderDatetime').value;
        if (!name || !datetime) { alert('नाम और समय भरें'); return; }
        const repeat = document.getElementById('reminderRepeat').value;
        const forWhom = document.getElementById('reminderForWhom').value;
        const category = document.getElementById('reminderCategory').value;
        const message = document.getElementById('reminderMessage').value;

        // if we are editing, remove old reminder first
        if (pendingEditId) {
            reminders = reminders.filter(r => r.id !== pendingEditId);
            pendingEditId = null;
        }

        const start = new Date(datetime).getTime();
        const id = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        const newReminder = {
            id, name, startDatetime: datetime, repeat, forWhom, category, message,
            completed: false,
            nextDue: start
        };
        reminders.push(newReminder);
        saveReminders();
        renderDashboard();
        renderAllReminders();
        // switch to list
        showSection('list');
    });

    // delete
    window.deleteReminder = (id) => {
        reminders = reminders.filter(r => r.id !== id);
        saveReminders();
        renderDashboard();
        renderAllReminders();
    };
    // toggle complete
    window.toggleComplete = (id) => {
        const r = reminders.find(r => r.id === id);
        if (r) {
            r.completed = !r.completed;
            if (r.completed) r.nextDue = null;
            else if (!r.nextDue && r.startDatetime) r.nextDue = new Date(r.startDatetime).getTime();
            saveReminders();
            renderDashboard();
            renderAllReminders();
        }
    };
    // edit - fill form and switch
    window.editReminder = (id) => {
        const r = reminders.find(r => r.id === id);
        if (!r) return;
        document.getElementById('reminderName').value = r.name;
        document.getElementById('reminderDatetime').value = r.startDatetime;
        document.getElementById('reminderRepeat').value = r.repeat;
        document.getElementById('reminderForWhom').value = r.forWhom;
        document.getElementById('reminderCategory').value = r.category;
        document.getElementById('reminderMessage').value = r.message || '';
        pendingEditId = id; // mark for edit
        showSection('form');
    };

    // ---------- voice input (Web Speech API) ----------
    document.getElementById('voiceInputBtn').addEventListener('click', () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('आपका ब्राउज़र वॉयस इनपुट सपॉर्ट नहीं करता'); return; }
        const recognition = new SpeechRecognition();
        recognition.lang = 'hi-IN';
        recognition.interimResults = false;
        recognition.start();
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            document.getElementById('reminderMessage').value = transcript;
            // try to parse simple command: "2 घंटे बाद पानी पीना है"
            if (transcript.includes('बाद') || transcript.includes('घंटे')) {
                // very basic: set time 2 hour later etc. We'll just fill message.
            }
        };
    });

    // ---------- profile modal ----------
    const modal = document.getElementById('profileModal');
    document.getElementById('editProfileBtn').addEventListener('click', () => {
        document.getElementById('modalName').value = currentUser.name || '';
        document.getElementById('modalRole').value = currentUser.role || 'student';
        document.getElementById('modalFamily').value = (currentUser.family || []).join(', ');
        modal.classList.add('show');
    });
    document.getElementById('closeModalBtn').addEventListener('click', ()=> modal.classList.remove('show'));
    document.getElementById('saveProfileBtn').addEventListener('click', () => {
        currentUser.name = document.getElementById('modalName').value || 'अतिथि';
        currentUser.role = document.getElementById('modalRole').value;
        const familyStr = document.getElementById('modalFamily').value;
        currentUser.family = familyStr.split(',').map(s => s.trim()).filter(s => s);
        saveUser();
        updateForWhomDropdown();
        document.getElementById('profileName').innerText = currentUser.name;
        document.getElementById('profileRole').innerText = 
            currentUser.role==='student'?'🎓 स्टूडेंट':currentUser.role==='parent'?'👪 पेरेंट्स':'🧑 अन्य';
        modal.classList.remove('show');
        renderDashboard();
    });

    // ---------- navigation ----------
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = {
        dashboard: document.getElementById('dashboardSection'),
        form: document.getElementById('formSection'),
        list: document.getElementById('listSection')
    };
    function showSection(name) {
        Object.values(sections).forEach(s => s.classList.remove('active-section'));
        sections[name].classList.add('active-section');
        navBtns.forEach(b => b.classList.remove('active'));
        document.querySelector(`.nav-btn[data-section="${name}"]`).classList.add('active');
        if (name === 'list') renderAllReminders();
        if (name === 'dashboard') renderDashboard();
    }
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            showSection(section);
        });
    });

    // filter events
    document.getElementById('searchInput')?.addEventListener('input', renderAllReminders);
    document.getElementById('categoryFilter')?.addEventListener('change', renderAllReminders);
    document.getElementById('statusFilter')?.addEventListener('change', renderAllReminders);

    // ---------- dark / light + lang toggle (simple) ----------
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        themeToggle.innerText = document.body.classList.contains('dark-mode') ? '☀️ लाइट' : '🌙 डार्क';
    });
    const langToggle = document.getElementById('langToggle');
    langToggle.addEventListener('click', () => {
        // just toggle placeholder for now
        currentLang = currentLang==='hi'?'en':'hi';
        langToggle.innerText = currentLang==='hi' ? '🌐 ENGLISH' : '🌐 हिंदी';
        document.getElementById('greetingMsg').innerText = currentLang==='hi'?'नमस्ते':'Hello';
    });

    // ---------- initial bootstrap ----------
    loadUser();
    loadReminders();
    updateForWhomDropdown();
    document.getElementById('profileName').innerText = currentUser.name;
    document.getElementById('profileRole').innerText = 
        currentUser.role==='student'?'🎓 स्टूडेंट':currentUser.role==='parent'?'👪 पेरेंट्स':'🧑 अन्य';
    renderDashboard();
    renderAllReminders();
    showSection('dashboard');

    // request notification permission on load
    if (Notification.permission === 'default') Notification.requestPermission();

    // For demo: add sample reminders if empty
    if (reminders.length === 0) {
        const sample = [
            { id: 's1', name: '💧 पानी पीना', startDatetime: new Date(Date.now()+3600000).toISOString().slice(0,16), repeat: 'daily', forWhom: 'खुद', category:'health', message:'पानी पी लो', completed:false, nextDue: Date.now()+3600000 },
            { id: 's2', name: '📚 पढ़ाई का समय', startDatetime: new Date(Date.now()+7200000).toISOString().slice(0,16), repeat: 'daily', forWhom: 'खुद', category:'study', message:'गणित पढ़ना', completed:false, nextDue: Date.now()+7200000 },
        ];
        reminders.push(...sample);
        saveReminders();
    }
})();
















(function() {
    // ---------- state ----------
    let currentUser = {
        name: 'राहुल',
        role: 'student',
        family: ['मम्मी', 'पापा', 'अनु'],
        coins: 0
    };
    let reminders = [];
    let pendingEditId = null;
    let audioCtx = null;
    let soundEnabled = false;
    let timeouts = {}; // store setTimeout ids by reminder id

    // Queue for reminders that are due
    let reminderQueue = [];
    let isModalActive = false;

    // ---------- load / save (same as before) ----------
    function loadUser() {
        const stored = localStorage.getItem('lifeCoach_user');
        if (stored) {
            try { currentUser = JSON.parse(stored); } catch(e){}
        }
        if (!currentUser.family) currentUser.family = [];
        if (currentUser.coins === undefined) currentUser.coins = 0;
    }
    function saveUser() {
        localStorage.setItem('lifeCoach_user', JSON.stringify(currentUser));
    }

    function loadReminders() {
        const stored = localStorage.getItem('lifeCoach_reminders');
        if (stored) {
            try { reminders = JSON.parse(stored); } catch(e){ reminders = []; }
        } else {
            reminders = [];
        }
        reminders.forEach(r => {
            if (r.completed === undefined) r.completed = false;
        });
    }
    function saveReminders() {
        localStorage.setItem('lifeCoach_reminders', JSON.stringify(reminders));
    }

    // ---------- sound alarm (Web Audio beep) ----------
    function initAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // resume on user interaction
        document.addEventListener('click', () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            soundEnabled = true;
        }, { once: true });
    }

    function playAlarm() {
        if (!audioCtx || audioCtx.state !== 'running') return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    // ---------- schedule a single reminder (same as before) ----------
    function scheduleReminder(reminder) {
        if (reminder.completed || !reminder.nextDue) return;
        const now = Date.now();
        const delay = reminder.nextDue - now;
        if (delay <= 0) {
            // already due, trigger immediately
            triggerReminder(reminder);
            return;
        }
        if (timeouts[reminder.id]) clearTimeout(timeouts[reminder.id]);
        timeouts[reminder.id] = setTimeout(() => triggerReminder(reminder), delay);
    }

    // ---------- new queue and modal handling ----------
    function triggerReminder(reminder) {
        // Add to queue
        reminderQueue.push(reminder);
        processQueue();
    }

    function processQueue() {
        if (isModalActive || reminderQueue.length === 0) return;
        isModalActive = true;
        const reminder = reminderQueue.shift();

        // Show modal
        const modal = document.getElementById('reminderPopup');
        document.getElementById('popupReminderName').innerText = reminder.name;
        document.getElementById('popupReminderMessage').innerText = reminder.message || 'याद दिलाना है';
        modal.classList.add('show');

        // Play sound
        playAlarm();

        // Store current reminder for button actions
        window.currentPopupReminder = reminder;
    }

    function closeModal() {
        document.getElementById('reminderPopup').classList.remove('show');
        isModalActive = false;
        processQueue(); // check for next
    }

    // Handle Done button
    document.getElementById('popupDone').addEventListener('click', () => {
        const reminder = window.currentPopupReminder;
        if (!reminder) return;

        // Mark as completed
        reminder.completed = true;
        reminder.nextDue = null;

        // Award coins
        currentUser.coins += 10;
        saveUser();
        updateCoinsDisplay();

        saveReminders();
        closeModal();
        renderDashboard();
        renderAllReminders();
    });

    // Handle Cancel (snooze 5 minutes)
    document.getElementById('popupCancel').addEventListener('click', () => {
        const reminder = window.currentPopupReminder;
        if (!reminder) return;

        // Snooze for 5 minutes
        const now = Date.now();
        reminder.nextDue = now + 5 * 60 * 1000; // 5 minutes

        // If it was a one-time reminder, keep it pending (not completed)
        // For repeating, we just shift this occurrence
        // Reschedule it
        scheduleReminder(reminder);

        saveReminders();
        closeModal();
        renderDashboard();
        renderAllReminders();
    });

    // ---------- coins display ----------
    function updateCoinsDisplay() {
        const el = document.getElementById('coinsDisplay');
        if (el) el.innerText = `🪙 ${currentUser.coins}`;
    }

    // ---------- UI renders (same as before, but ensure they call updateCoinsDisplay where needed) ----------
    function renderDashboard() {
        // ... your existing dashboard render code ...
        // (copy from your previous version)
    }

    function renderAllReminders() {
        // ... your existing list render code ...
    }

    // Override toggleComplete to award coins (same as before)
    window.toggleComplete = (id) => {
        const r = reminders.find(r => r.id === id);
        if (r) {
            const wasCompleted = r.completed;
            r.completed = !r.completed;
            if (!wasCompleted && r.completed) {
                currentUser.coins += 10;
                saveUser();
                updateCoinsDisplay();
                r.nextDue = null;
            } else if (wasCompleted && !r.completed) {
                r.nextDue = new Date(r.startDatetime).getTime();
                scheduleReminder(r);
            }
            saveReminders();
            renderDashboard();
            renderAllReminders();
        }
    };

    // On save new reminder (same, but call scheduleReminder)
    document.getElementById('saveReminderBtn').addEventListener('click', (e) => {
        e.preventDefault();
        // ... validation and creation ...
        // After creating newReminder, push, save, then:
        scheduleReminder(newReminder);
        // ... rest ...
    });

    // Delete reminder
    window.deleteReminder = (id) => {
        if (timeouts[id]) clearTimeout(timeouts[id]);
        delete timeouts[id];
        reminders = reminders.filter(r => r.id !== id);
        saveReminders();
        renderDashboard();
        renderAllReminders();
    };

    // Profile save
    document.getElementById('saveProfileBtn').addEventListener('click', () => {
        // ... existing ...
        saveUser();
        updateCoinsDisplay();
        // ...
    });

    // Initialise audio
    initAudio();

    // Load everything
    loadUser();
    loadReminders();
    // Reschedule all active reminders
    reminders.forEach(r => scheduleReminder(r));
    updateCoinsDisplay();

    // Render initial UI
    renderDashboard();
    renderAllReminders();

    // ... rest of your initialisation (lang toggle, theme, etc.) ...
})();