import { 
    auth,
    db,

    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,

    onAuthStateChanged,
    signOut,

    collection,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    addDoc,
    deleteDoc

} from './firebase.js';
// --- Global State ---
let currentUser = null;
let globalData = { announcements: [], homework: [], notes: [], tests: [] };
let activeTest = null;
let unsubscribes = [];

// --- Initialization ---
const initAuth = async () => {
    // Listen for Auth State Changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Check if user document exists to confirm they are registered in our portal
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                await fetchUserRole(user);
                setupLiveListeners();
                updateAuthUI();
                if (['landing', 'login', 'register'].includes(getCurrentView())) navigate('dashboard-home');
            }
        }
    });
};
initAuth();

// --- Auth Functions ---
async function fetchUserRole(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        let role = 'student';
        let name = 'Student';

        if (userSnap.exists()) {
            const data = userSnap.data();
            role = data.role || 'student';
            name = data.name || name;
        }
        
        currentUser = { uid: user.uid, name, role };
    } catch (e) {
        console.error("Error fetching user data:", e);
        currentUser = { uid: user.uid, name: 'Student', role: 'student' };
    }
}

async function handleAuth(e, type) {

    e.preventDefault();

    try {

        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;

        let userCred;

        // REGISTER
        if (type === 'register') {

            userCred = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCred.user;

            const name = document.getElementById('regName').value;

            const adminKey = document.getElementById('regAdminKey').value;

            const role =
                adminKey === 'ADMIN2026'
                    ? 'admin'
                    : 'student';

            await setDoc(doc(db, 'users', user.uid), {
                name: name,
                email: email,
                role: role,
                createdAt: new Date().getTime()
            });

            await fetchUserRole(user);

            setupLiveListeners();

            updateAuthUI();

            showNotification(`Account created! Logged in as ${role}.`);

            navigate('dashboard-home');
        }

        // LOGIN
        else if (type === 'login') {

            userCred = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCred.user;

            const userRef = doc(db, 'users', user.uid);

            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {

                showNotification("Account not found. Please register first.");

                return;
            }

            await fetchUserRole(user);

            setupLiveListeners();

            updateAuthUI();

            showNotification("Successfully logged in.");

            navigate('dashboard-home');
        }

    } catch (error) {

        console.error(error);

        showNotification(error.message);
    }
}

async function executeLogout() {
    await signOut(auth);
    currentUser = null;
    clearListeners();
    updateAuthUI();
    showNotification("Logged out successfully.");
    navigate('landing');
}

// --- Live Firestore Listeners ---
function setupLiveListeners() {
    clearListeners();

    const collections = ['announcements', 'homework', 'notes', 'tests'];
    
    collections.forEach(colName => {
        const colRef = collection(db, colName);
        const unsub = onSnapshot(colRef, (snapshot) => {
            const data = [];
            snapshot.forEach(document => data.push({ id: document.id, ...document.data() }));
            data.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
            globalData[colName] = data;
            renderData(colName, data);
        }, (error) => {
            console.error(`Listener error on ${colName}:`, error);
        });
        unsubscribes.push(unsub);
    });
}

function clearListeners() {
    unsubscribes.forEach(unsub => unsub());
    unsubscribes = [];
}

// --- Render Functions ---
function renderData(collectionName, data) {
    if (collectionName === 'announcements') {
        document.getElementById('dashLatestAnnouncement').innerText = data.length > 0 ? data[0].content : "No recent announcements.";
        
        const container = document.getElementById('announcementsContainer');
        if (data.length === 0) container.innerHTML = '<p class="text-slate-500">No notices posted.</p>';
        else {
            container.innerHTML = data.map(item => `
                <div class="p-4 rounded-xl border border-slate-100 bg-slate-50 shadow-sm mb-3">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="font-bold text-slate-800">${item.title}</h4>
                        <span class="text-xs text-blue-600 font-medium">${new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p class="text-sm text-slate-600">${item.content}</p>
                </div>
            `).join('');
        }

        if (currentUser?.role === 'admin') {
            document.getElementById('adminAnnList').innerHTML = data.map(item => `
                <div class="flex justify-between items-center bg-slate-50 p-2 rounded border">
                    <span class="truncate font-medium">${item.title}</span>
                    <button onclick="deleteDocItem('announcements', '${item.id}')" class="text-red-500 hover:underline text-xs">Delete</button>
                </div>
            `).join('');
        }
    }

    else if (collectionName === 'homework') {
        document.getElementById('dashHomeworkCount').innerText = `${data.length} Task(s)`;
        
        const container = document.getElementById('homeworkContainer');
        if (data.length === 0) container.innerHTML = '<p class="text-slate-500">No homework assigned.</p>';
        else {
            container.innerHTML = data.map(item => `
                <div class="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-start gap-4">
                    <input type="checkbox" class="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" onclick="this.parentElement.classList.toggle('opacity-50')">
                    <div class="flex-1">
                        <h4 class="font-bold text-slate-800 text-lg">${item.title}</h4>
                        <p class="text-slate-600 text-sm mt-1">${item.desc}</p>
                        <div class="flex items-center gap-2 mt-3 text-xs font-medium text-slate-500">
                            <span class="bg-red-100 text-red-700 px-2 py-1 rounded">Due: ${item.dueDate}</span>
                            <span class="bg-slate-200 px-2 py-1 rounded">Sub: ${item.subject}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        if (currentUser?.role === 'admin') {
            document.getElementById('adminHwList').innerHTML = data.map(item => `
                <div class="flex justify-between items-center bg-slate-50 p-2 rounded border">
                    <span class="truncate font-medium">${item.title}</span>
                    <button onclick="deleteDocItem('homework', '${item.id}')" class="text-red-500 hover:underline text-xs">Delete</button>
                </div>
            `).join('');
        }
    }

    else if (collectionName === 'notes') {
        document.getElementById('dashNotesCount').innerText = `${data.length} PDFs`;
        
        const container = document.getElementById('notesContainer');
        if (data.length === 0) container.innerHTML = '<p class="text-slate-500">No notes available.</p>';
        else {
            const subjects = ['Physics', 'Chemistry', 'Mathematics'];
            container.innerHTML = subjects.map(sub => {
                const subNotes = data.filter(n => n.subject === sub);
                if (subNotes.length === 0) return '';
                
                const colorClass = sub === 'Physics' ? 'blue' : sub === 'Chemistry' ? 'emerald' : 'amber';
                
                return `
                <div class="mb-6 border-b pb-4">
                    <h3 class="text-lg font-bold text-slate-800 mb-3 border-l-4 border-${colorClass}-500 pl-2">${sub}</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        ${subNotes.map(note => `
                            <div class="border border-slate-200 rounded-xl p-4 hover:border-${colorClass}-400 hover:shadow-md bg-white flex justify-between items-center">
                                <div class="font-medium text-sm text-slate-800 truncate pr-2">${note.title}</div>
                                <button onclick="window.open('${note.driveLink || note.url}', '_blank')" class="bg-${colorClass}-100 text-${colorClass}-700 p-2 rounded-lg hover:bg-${colorClass}-600 hover:text-white shrink-0">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }).join('');
        }

        if (currentUser?.role === 'admin') {
            document.getElementById('adminNotesList').innerHTML = data.map(item => `
                <div class="flex justify-between items-center bg-slate-50 p-2 rounded border">
                    <span class="truncate font-medium">${item.title}</span>
                    <button onclick="deleteDocItem('notes', '${item.id}')" class="text-red-500 hover:underline text-xs">Delete</button>
                </div>
            `).join('');
        }
    }

    else if (collectionName === 'tests') {
        document.getElementById('dashTestCount').innerText = `${data.length} Active`;
        
        const container = document.getElementById('testsContainer');
        if (data.length === 0) container.innerHTML = '<p class="text-slate-500">No mock tests available.</p>';
        else {
            container.innerHTML = data.map(item => `
                <div class="p-4 border border-slate-200 rounded-xl bg-slate-50 flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-slate-800">${item.title}</h4>
                        <p class="text-xs text-slate-500 mt-1">Subject: ${item.subject} • 1 Question Demo</p>
                    </div>
                    <button onclick='startSpecificTest(${JSON.stringify(item).replace(/'/g, "\\'")})' class="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900">Take Test</button>
                </div>
            `).join('');
        }

        if (currentUser?.role === 'admin') {
            document.getElementById('adminTestsList').innerHTML = data.map(item => `
                <div class="flex justify-between items-center bg-slate-50 p-2 rounded border">
                    <span class="truncate font-medium">${item.title}</span>
                    <button onclick="deleteDocItem('tests', '${item.id}')" class="text-red-500 hover:underline text-xs">Delete</button>
                </div>
            `).join('');
        }
    }
}

// --- Admin CRUD Operations ---
async function adminAddAnnouncement(e) {
    e.preventDefault();
    try {
        await addDoc(collection(db, 'announcements'), {
            title: document.getElementById('adminAnnTitle').value,
            content: document.getElementById('adminAnnContent').value,
            createdAt: new Date().getTime()
        });
        e.target.reset();
        showNotification("Announcement posted!");
    } catch(err) { showNotification("Error: " + err.message); }
}

async function adminAddHomework(e) {
    e.preventDefault();
    try {
        await addDoc(collection(db, 'homework'), {
            title: document.getElementById('adminHwTitle').value,
            subject: document.getElementById('adminHwSubject').value,
            desc: document.getElementById('adminHwDesc').value,
            dueDate: document.getElementById('adminHwDue').value,
            createdAt: new Date().getTime()
        });
        e.target.reset();
        showNotification("Homework assigned!");
    } catch(err) { showNotification("Error: " + err.message); }
}

async function adminAddTest(e) {
    e.preventDefault();
    try {
        await addDoc(collection(db, 'tests'), {
            title: document.getElementById('adminTestTitle').value,
            subject: document.getElementById('adminTestSubject').value,
            question: document.getElementById('adminTestQ').value,
            options: [
                document.getElementById('adminTestOpt0').value,
                document.getElementById('adminTestOpt1').value,
                document.getElementById('adminTestOpt2').value,
                document.getElementById('adminTestOpt3').value
            ],
            correctAnswer: parseInt(document.getElementById('adminTestAns').value),
            createdAt: new Date().getTime()
        });
        e.target.reset();
        showNotification("Test created!");
    } catch(err) { showNotification("Error: " + err.message); }
}

async function adminUploadNote(e) {
    e.preventDefault();
    const title = document.getElementById('adminNoteTitle').value;
    const subject = document.getElementById('adminNoteSubject').value;
    const link = document.getElementById('adminNoteLink').value;

    try { new URL(link); } catch (_) { return showNotification("Please enter a valid Google Drive URL."); }

    const btn = document.getElementById('btnUploadNote');
    btn.innerText = "Adding Note...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, 'notes'), {
            title: title,
            subject: subject,
            driveLink: link,
            url: link,
            createdAt: new Date().getTime()
        });

        e.target.reset();
        showNotification("Note link added successfully!");
    } catch(err) { 
        console.error(err);
        showNotification("Failed to add note link."); 
    } finally {
        btn.innerText = "Add to Database";
        btn.disabled = false;
    }
}

async function deleteDocItem(collectionName, id) {
    if(!confirm("Delete this item?")) return;
    try {
        await deleteDoc(doc(db, collectionName, id));
        showNotification("Deleted.");
    } catch(e) { showNotification("Error deleting."); }
}

// --- Active Test Logic ---
function startSpecificTest(testObj) {
    activeTest = testObj;
    document.getElementById('test-list-screen').classList.add('hidden');
    document.getElementById('test-active-screen').classList.remove('hidden');
    
    document.getElementById('activeTestTitle').innerText = testObj.title;
    document.getElementById('activeTestSubject').innerText = testObj.subject;
    document.getElementById('testQText').innerText = testObj.question;
    
    const optionsHtml = testObj.options.map((opt, idx) => `
        <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-100 bg-white transition-colors">
            <input type="radio" name="testOption" value="${idx}" class="w-4 h-4 text-blue-600">
            <span class="text-sm font-medium text-slate-700">${opt}</span>
        </label>
    `).join('');
    document.getElementById('testOptions').innerHTML = optionsHtml;
}

function cancelTest() {
    activeTest = null;
    document.getElementById('test-list-screen').classList.remove('hidden');
    document.getElementById('test-active-screen').classList.add('hidden');
}

function submitTest() {
    if(!activeTest) return;
    const selected = document.querySelector('input[name="testOption"]:checked');
    if(!selected) return showNotification("Please select an answer.");
    
    const isCorrect = parseInt(selected.value) === activeTest.correctAnswer;
    
    if(isCorrect) {
        showNotification("Correct! Perfect score.");
    } else {
        showNotification(`Incorrect. The right answer was option ${activeTest.correctAnswer + 1}.`);
    }
    cancelTest();
}

// --- UI & Routing ---
function getCurrentView() {
    const active = document.querySelector('.view-section.active');
    return active ? active.id.replace('view-', '') : 'landing';
}

function navigate(viewId) {
    const publicRoutes = ['landing', 'login', 'register'];
    const protectedRoutes = ['dashboard-home', 'notes', 'homework', 'test', 'announcements'];
    const adminRoutes = ['admin-manage'];
    
    if (!publicRoutes.includes(viewId) && !currentUser) {
        showNotification("Login required.");
        return navigate('login');
    }
    if (adminRoutes.includes(viewId) && currentUser?.role !== 'admin') {
        showNotification("Admin access denied.");
        return navigate('dashboard-home');
    }

    if (publicRoutes.includes(viewId)) {
        document.getElementById('public-layout').classList.remove('hidden');
        document.getElementById('dashboard-layout').classList.add('hidden');
    } else {
        document.getElementById('public-layout').classList.add('hidden');
        document.getElementById('dashboard-layout').classList.remove('hidden');
    }

    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.toggle('active', link.dataset.view === viewId);
    });

    const titles = { 'dashboard-home':'Dashboard', 'notes':'Study Notes', 'homework':'Homework', 'test':'Mock Tests', 'announcements':'Notice Board', 'admin-manage':'Teacher Panel' };
    if(titles[viewId]) document.getElementById('headerTitle').innerText = titles[viewId];

    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) toggleSidebar();
    
    window.scrollTo(0,0);
}

function updateAuthUI() {
    if (currentUser) {
        document.getElementById('navUserName').innerText = currentUser.name;
        document.getElementById('navUserRole').innerText = currentUser.role;
        document.getElementById('navUserInitial').innerText = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('dashFirstName').innerText = currentUser.name;
        
        if(currentUser.role === 'admin') {
            document.getElementById('admin-nav-section').classList.remove('hidden');
        } else {
            document.getElementById('admin-nav-section').classList.add('hidden');
        }
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-backdrop').classList.toggle('hidden');
}

function showNotification(msg) {
    const notif = document.getElementById('notificationArea');
    document.getElementById('notificationText').innerText = msg;
    notif.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => notif.classList.add('opacity-0', 'pointer-events-none'), 3000);
}

// Expose functions to window so HTML inline onclicks work with modules
window.navigate = navigate;
window.handleAuth = handleAuth;
window.executeLogout = executeLogout;
window.toggleSidebar = toggleSidebar;
window.adminAddAnnouncement = adminAddAnnouncement;
window.adminAddHomework = adminAddHomework;
window.adminAddTest = adminAddTest;
window.adminUploadNote = adminUploadNote;
window.deleteDocItem = deleteDocItem;
window.startSpecificTest = startSpecificTest;
window.cancelTest = cancelTest;
window.submitTest = submitTest;

// Boot initial state
navigate('landing');