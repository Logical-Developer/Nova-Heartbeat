// ═══════════════════════════════════════════════════════════
// 06-runner.js
// ═══════════════════════════════════════════════════════════

  function enqueue(task) {
    const id = task.id || ('t_' + now() + '_' + Math.random().toString(36).slice(2,6));
    const s = readState();
    if (s.tasks.some(t => t.id === id) || (s.currentJob && s.currentJob.id === id)) {
      log('queue', `⊘ dup task ${id.slice(-12)} — skipped`);
      return null;
    }
    const t = {
      id, plugin: task.plugin,
      priority: task.priority ?? 5,
      villageId: task.villageId || task.target?.village,
      target: task.target,
      payload: task.payload || {},
      requiresFlag: task.requiresFlag || null,
      createdAt: task.createdAt || now(),
      readyAt: now() + (task.delayMs || 0),
      expiresAt: now() + (task.ttlMs || 30 * 60 * 1000),
      attempts: task.attempts || 0,
      maxAttempts: task.maxAttempts ?? CFG.MAX_ATTEMPTS,
      lastError: null,
    };
    patch(st => st.tasks.push(t));
    log('queue', `+ ${t.plugin} → ${t.target.page}@${vLabel(t.target.village)} (p=${t.priority})`);
    return id;
  }
  function cancelTask(id) {
    const s = readState();
    let removed = false;
    if (s.currentJob && s.currentJob.id === id) {
      log('queue', `✗ cancel currentJob: ${id.slice(-12)}`);
      patch(st => { st.currentJob = null; });
      removed = true;
    }
    const before = s.tasks.length;
    patch(st => { st.tasks = st.tasks.filter(t => t.id !== id); });
    const after = readState().tasks.length;
    if (after !== before) {
      log('queue', `✗ cancel task: ${id.slice(-12)}`);
      removed = true;
    }
    return removed;
  }
  function listTasks() { return readState().tasks.slice(); }

  function isFlagActive(flag, s) {
    if (!flag) return true;
    if (flag === 'heartbeat') return s.heartbeat?.enabled === true;
    const m = /^plugin:(\w+):(\w+)$/.exec(flag);
    if (m) { const plugin = s.plugins[m[1]]; return plugin && plugin[m[2]] === true; }
    return true;
  }

  function isVillageBusy(vid, s) {
    if (!vid) return false;
    const vidStr = String(vid);
    if (s.currentJob && String(s.currentJob.target.village) === vidStr) return true;
    const v = s.villages[vidStr];
    if (!v) return false;
    if (!v.lastSeen || (now() - v.lastSeen) > CFG.VILLAGE_DATA_STALE_MS) return false;
    const bq = v.buildQueue || [];
    const bqAt = v.buildQueueAt || 0;
    const travianPlus = s.plugins?.Builder?.travianPlus === true;
    const maxSlots = travianPlus ? 2 : 1;
    if ((now() - bqAt) < CFG.QUEUE_FRESH_FOR_BUSY_MS && bq.length >= maxSlots) return true;
    return false;
  }

  // ═════ 2.0.2.21: pickRunnableTask — exempt rotation + Builder rotation + Builder ═════
  // ═════ 0.0.2: filter by readyAt — a not-yet-due task must not block the queue ═════
  function pickRunnableTask() {
    const s = readState();
    const n = now();
    // ═══ 0.0.3: plugin lock — while a plugin holds the queue, only its tasks run ═══
    const lock = checkPluginLock();
    const candidates = s.tasks.filter(t => {
      if (t.expiresAt <= n) return false;
      // ═══ 0.0.2 FIX: not due yet (readyAt) → skip it, never block the rest of the queue ═══
      if (t.readyAt > n) return false;
      if (!isFlagActive(t.requiresFlag, s)) return false;
      // ═══ 0.0.3: not owned by the lock holder → stay queued (no village switch) ═══
      if (lock && !isTaskAllowedByLock(t, lock)) return false;
      // ═══ rotation tasks: never rejected based on busy ═══
      if (t.payload?.rotation) return true;
      // ═══ Builder tasks: they decide themselves ═══
      if (t.plugin === 'Builder') return true;
      // ═══ other tasks (normal Heartbeat)) ═══
      if (!t.payload?.isVerify && isVillageBusy(t.villageId || t.target?.village, s)) return false;
      return true;
    });
    if (!candidates.length) return null;
    candidates.sort((a,b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const dt = (a.createdAt || 0) - (b.createdAt || 0);
      if (dt !== 0) return dt;
      return String(a.id).localeCompare(String(b.id));
    });
    return candidates[0];
  }


  function setJobState(jobId, newState, extra = {}) {
    patch(s => {
      if (s.currentJob?.id === jobId) {
        s.currentJob.state = newState;
        s.currentJob.stateAt = now();
        Object.assign(s.currentJob, extra);
      }
    });
  }
  function finishJob(jobId, reason) {
    const s = readState();
    const job = s.currentJob;
    if (!job || job.id !== jobId) return;
    log('runner', `✓ done: ${job.plugin} (${reason})`);
    patch(st => { st.currentJob = null; });
    const p = plugins.get(job.plugin);
    if (p?.onComplete) try { p.onComplete({ job }); } catch {}
  }
  function retryOrFail(jobId, reason) {
    const s = readState();
    const job = s.currentJob;
    if (!job || job.id !== jobId) return;
    const attempt = (job.attempts||0) + 1;
    if (attempt >= job.maxAttempts) {
      log('runner', `✗ FAILED after ${attempt}: ${reason}`);
      patch(st => { st.currentJob = null; });
      const p = plugins.get(job.plugin);
      if (p?.onFail) try { p.onFail({ job, reason }); } catch {}
      return;
    }
    const backoff = CFG.RETRY_BACKOFF_MS[Math.min(attempt-1, CFG.RETRY_BACKOFF_MS.length-1)];
    log('runner', `↻ retry in ${backoff/1000}s (attempt ${attempt}): ${reason}`);
    patch(st => {
      if (st.currentJob?.id !== jobId) return;
      const moved = { ...st.currentJob, attempts: attempt, lastError: reason };
      moved.readyAt = now() + backoff;
      moved.createdAt = moved.createdAt || now();
      delete moved.state; delete moved.stateAt; delete moved.startedAt; delete moved.snapshotBefore;
      delete moved._hubBounceCount; delete moved._waitLogged;
      st.currentJob = null;
      st.tasks.push(moved);
    });
  }
  function saveCurrentJobAsTask(jobId, newState, extra = {}) {
    patch(st => {
      if (st.currentJob?.id !== jobId) return;
      const saved = { ...st.currentJob };
      saved.state = newState;
      saved.stateAt = now();
      saved.readyAt = now() + 2000;
      saved._sessionReset = false;
      Object.assign(saved, extra);
      delete saved.snapshotBefore;
      delete saved._hubBounceCount;
      delete saved._graceLogged;
      delete saved._domWaitLogged;
      st.tasks.push(saved);
      st.currentJob = null;
    });
  }

  function computeRotationInterval(nVillages) {
    if (nVillages < 2) return 5 * 60 * 1000;
    const target = CFG.ROTATION_TARGET_INTERVAL_MS / (nVillages - 1);
    const clamped = Math.max(CFG.ROTATION_MIN_INTERVAL_MS, target);
    const jitter = 1 + (Math.random() * 2 - 1) * CFG.ROTATION_JITTER;
    return Math.round(clamped * jitter);
  }

  // ═════ 2.0.2.21: rotationTick with full fixes ═════
  function rotationTick() {
    const s = readState();
    if (!s.heartbeat.enabled) return;
    // ═══ 0.0.3: plugin lock — no scheduled/urgent visits while a plugin owns the queue ═══
    const lock = checkPluginLock();
    if (lock) {
      if (s.heartbeat._lastLockLog !== lock.pluginId) {
        log('rotation', `⏸ rotation paused — plugin lock: ${lock.label}`);
        patch(st => { st.heartbeat._lastLockLog = lock.pluginId; });
      }
      if ((s.heartbeat.nextRotationAt || 0) < now() + 60 * 1000) {
        patch(st => { st.heartbeat.nextRotationAt = now() + 60 * 1000; });
      }
      return;
    }
    if (s.heartbeat._lastLockLog) patch(st => { st.heartbeat._lastLockLog = null; });
    const vids = Object.keys(s.villages).sort((a,b) => Number(a)-Number(b));
    if (vids.length < 2) return;
    if (s.currentJob) return;

    // ═══ FIX: if a rotation task is pending, do not enqueue again ═══
    const existingRotation = (s.tasks || []).find(t => t.payload?.rotation);
    if (existingRotation) {
      const n = now();
      const lastCheck = s.heartbeat._lastRotCheck || 0;
      if ((n - lastCheck) > 60000) {
        log('rotation', `⏳ rotation task pending (expires in ${Math.round((existingRotation.expiresAt - n)/1000)}s)`);
        patch(st => { st.heartbeat._lastRotCheck = n; });
      }
      return;
    }

    const curVid = curVillageId();
    const n = now();
    if (!curVid) return;

    const det = detectSwitchType(curVid);
    if (det) {
      const icon = det.type === 'nova' ? '🔄' : '👤';
      const label = det.type === 'nova' ? 'Nova' : 'manual';
      const elapsedStr = det.elapsed !== null ? `${Math.round(det.elapsed / 1000)}s` : '?';
      log('rotation', `${icon} ${label} village switch (${vLabel(det.from)} → ${vLabel(curVid)}) → reset (${elapsedStr})`);

      patch(st => {
        st.heartbeat.nextRotationAt = n + computeRotationInterval(vids.length);
        const v = st.villages[String(curVid)];
        if (v) v.lastSwitch = { type: det.type, from: det.from, at: n, elapsed: det.elapsed };
      });

      recordRotationContext(curVid);
      ssDel(SS_PAGE_MARK);
      return;
    }

    if (!ssGet(SS_ROT_FROM)) {
      recordRotationContext(curVid);
      patch(st => {
        if (!st.heartbeat.nextRotationAt) st.heartbeat.nextRotationAt = n + 5000;
      });
    }

    // ═══ FIX: if all were busy, reschedule 2min later (not skip) skip) ═══
    const freeVillages = vids.filter(v => !isVillageBusy(v, s));
    if (freeVillages.length === 0 && vids.length > 1) {
      if (!s.heartbeat._lastBusySkipLog || (n - s.heartbeat._lastBusySkipLog) > CFG.BUSY_SKIP_LOG_INTERVAL_MS) {
        log('rotation', `⏸ all ${vids.length} villages busy — reschedule in ${CFG.ROTATION_BUSY_RESCHEDULE_MS/60000}m`);
        patch(st => { st.heartbeat._lastBusySkipLog = n; });
      }
      patch(st => {
        st.heartbeat.nextRotationAt = n + CFG.ROTATION_BUSY_RESCHEDULE_MS;
      });
      return;
    }

    const urgent = vids.find(v => {
      if (String(v) === String(curVid)) return false;
      const vv = s.villages[v];
      if (!vv || !vv.lastSeen) return true;
      return (n - vv.lastSeen) > CFG.URGENT_AGE_MS;
    });
    if (urgent) {
      log('rotation', `🚨 urgent visit → ${vLabel(urgent)}`);
      recordRotationContext(curVid);
      ssSet(SS_PAGE_MARK, 'nova');
      enqueue({ plugin: 'Heartbeat', priority: 10, villageId: String(urgent), target: { page: 'dorf1', village: String(urgent) }, payload: { rotation: true, urgent: true }, requiresFlag: 'heartbeat', ttlMs: 3 * 60 * 1000, createdAt: now() });
      return;
    }

    const nextAt = s.heartbeat.nextRotationAt || 0;
    if (n < nextAt) return;

    const others = vids.filter(v => String(v) !== String(curVid));
    if (!others.length) {
      patch(st => st.heartbeat.nextRotationAt = n + computeRotationInterval(vids.length));
      recordRotationContext(curVid);
      return;
    }
    others.sort((a,b) => (s.villages[a].lastSeen || 0) - (s.villages[b].lastSeen || 0));
    const target = others[0];
    log('rotation', `⏱ scheduled visit → ${vLabel(target)}`);
    recordRotationContext(curVid);
    ssSet(SS_PAGE_MARK, 'nova');
    enqueue({ plugin: 'Heartbeat', priority: 3, villageId: String(target), target: { page: 'dorf1', village: String(target) }, payload: { rotation: true }, requiresFlag: 'heartbeat', ttlMs: 5 * 60 * 1000, createdAt: now() });
    patch(st => {
      st.heartbeat.nextRotationAt = n + computeRotationInterval(vids.length);
    });
  }



  function decideFromHub(job) {
    const s = readState();
    const v = s.villages[String(job.target.village)];
    if (!v) return { action: 'wait', delayMs: 5000, reason: 'no-village-data' };
    const plugin = plugins.get(job.plugin);
    if (plugin?.onDecide) {
      try {
        const decision = plugin.onDecide({ job, village: v });
        if (decision && decision.action) return decision;
      } catch (e) { log('runner', `⚠ onDecide threw: ${e.message}`); }
    }
    const bq = v.buildQueue || [];
    const bqAt = v.buildQueueAt || 0;
    const maxSlots = s.plugins?.Builder?.travianPlus ? 2 : 1;
    if ((now() - bqAt) < CFG.QUEUE_FRESH_FOR_BUSY_MS && bq.length >= maxSlots) {
      return { action: 'wait', delayMs: 60000, reason: 'queue-full-hub' };
    }
    return { action: 'build' };
  }

  async function advanceJob() {
    const s = readState();
    const job = s.currentJob;
    if (!job) return false;
    if (!s.heartbeat.enabled) {
      log('runner', `⏸ Heartbeat OFF — abandoning job ${job.plugin}`);
      patch(st => { st.currentJob = null; });
      return true;
    }
    const elapsed = now() - (job.stateAt || job.startedAt || now());
    const plugin = plugins.get(job.plugin);

    if (!plugin && job.state !== 'HUB_NAVIGATING' && job.state !== 'HUB_VISITING' && job.state !== 'HUB_DECIDING') {
      if (elapsed < CFG.PLUGIN_GRACE_MS) {
        if (!job._graceLogged) {
          log('runner', `⏳ waiting for plugin '${job.plugin}' to load (max ${Math.round(CFG.PLUGIN_GRACE_MS/1000)}s)`);
          patch(st => { if (st.currentJob?.id === job.id) st.currentJob._graceLogged = true; });
        }
        return true;
      }
      log('runner', `✗ plugin '${job.plugin}' not loaded after ${elapsed}ms`);
      retryOrFail(job.id, 'no-plugin');
      return true;
    }

    switch (job.state) {
      case 'HUB_NAVIGATING': {
        const targetGid = job.target.params?.gid;
        const hubPage = getTargetHub(targetGid);
        const hubTarget = { page: hubPage, village: job.target.village };
        const curVid = curVillageId();
        const pt = pageType();

        if (isOnTarget(hubTarget)) {
          log('runner', `✓ at hub ${hubPage}@${vLabel(job.target.village)}`);
          setJobState(job.id, 'HUB_VISITING');
          return true;
        }

        if (pt === 'build') {
          const closeBtn = Resolver.resolve({ page: 'dorf2', village: job.target.village });
          if (closeBtn) {
            log('runner', `← closing build.php first`);
            await humanClick(closeBtn.el);
            return true;
          }
        }

        if (isHub() && String(curVid) === String(job.target.village) && pt !== hubPage) {
          const r = Resolver.resolve(hubTarget);
          if (r) {
            log('runner', `→ switching to ${hubPage} [${r.strategy}]`);
            await humanClick(r.el);
            return true;
          }
        }

        if (isHub() && String(curVid) !== String(job.target.village)) {
          const r = Resolver.resolve(hubTarget);
          if (r) {
            log('runner', `↪ switching to ${vLabel(job.target.village)} ${hubPage} [${r.strategy}]`);
            recordRotationContext(curVid);
            ssSet(SS_PAGE_MARK, 'nova');
            await humanClick(r.el);
            return true;
          }
        }

        if (!isHub()) {
          const r = Resolver.resolve(hubTarget);
          if (r) { await humanClick(r.el); return true; }
        }

        if (elapsed > CFG.LIMIT_HUB_NAVIGATING) retryOrFail(job.id, 'hub-nav-timeout');
        return true;
      }

      case 'HUB_VISITING': {
        if (elapsed < 200) return false;
        if (!isDomReadyForDorf()) {
          if (elapsed > CFG.HUB_DOM_READY_MS * 2) {
            log('runner', `⏳ hub DOM not ready after ${elapsed}ms`);
            retryOrFail(job.id, 'hub-dom-timeout');
            return true;
          }
          return false;
        }
        const stable = await waitForHubStable(CFG.HUB_STABLE_MAX_MS);
        if (!stable.ok) {
          if (elapsed > CFG.HUB_DOM_READY_MS + CFG.HUB_STABLE_MAX_MS) {
            log('runner', `⏳ hub not stable after ${elapsed}ms → ${stable.reason}`);
            retryOrFail(job.id, 'hub-stable-timeout');
            return true;
          }
          return false;
        }
        captureCurrentVillage();
        log('runner', `📸 hub captured ${vLabel(job.target.village)} (queue: ${stable.hasBuildingList ? 'present' : 'empty'}, waited ${stable.waited}ms)`);
        setJobState(job.id, 'HUB_DECIDING');
        return true;
      }

      case 'HUB_DECIDING': {
        const decision = decideFromHub(job);
        log('runner', `🤔 decide: ${decision.action}${decision.reason ? ' — ' + decision.reason : ''}`);
        if (decision.action === 'wait') { pauseSimple(job.id, decision.delayMs, decision.reason); return true; }
        if (decision.action === 'done') { finishJob(job.id, decision.reason); return true; }
        if (decision.action === 'skip') { pauseSimple(job.id, decision.delayMs || 30000, decision.reason || 'skipped'); return true; }
        setJobState(job.id, 'BUILD_NAVIGATING');
        return true;
      }

      case 'BUILD_NAVIGATING': {
        if (elapsed < CFG.BUILD_NAV_DELAY_MIN) return false;

        if (isOnTarget(job.target, { relaxBuildParams: true })) {
          log('runner', `✓ arrived at build.php (relaxed)`);
          setJobState(job.id, 'BUILD_EXECUTING');
          return true;
        }
        const targetGid = job.target.params?.gid;
        const hubPage = getTargetHub(targetGid);
        if (pageType() === hubPage && String(curVillageId()) === String(job.target.village)) {
          const r = Resolver.resolve(job.target);
          if (r) {
            log('runner', `🎯 tile click → build.php [${r.strategy}]`);
            await humanClick(r.el);
            return true;
          } else {
            log('runner', `✗ tile not found (slot=${job.target.params?.id}, gid=${targetGid})`);
            retryOrFail(job.id, 'no-tile');
            return true;
          }
        }
        if (!job._hubBounceCount) patch(st => { if (st.currentJob?.id === job.id) st.currentJob._hubBounceCount = 0; });
        const bounce = (job._hubBounceCount || 0) + 1;
        patch(st => { if (st.currentJob?.id === job.id) st.currentJob._hubBounceCount = bounce; });
        if (bounce > CFG.MAX_HUB_BOUNCE) {
          log('runner', `✗ too many hub bounces (${bounce}) → fail`);
          retryOrFail(job.id, 'too-many-bounces');
          return true;
        }
        log('runner', `⚠ not in hub for build — going back (bounce ${bounce}/${CFG.MAX_HUB_BOUNCE})`);
        setJobState(job.id, 'HUB_NAVIGATING');
        return true;
      }

      case 'BUILD_EXECUTING': {
        if (!isOnTarget(job.target, { relaxBuildParams: true })) {
          if (isHub()) { setJobState(job.id, 'BUILD_CONFIRMING'); return true; }
          retryOrFail(job.id, 'left-target');
          return true;
        }
        if (!isDomReadyForBuildPage()) {
          if (elapsed > CFG.DOM_READY_TIMEOUT_MS) {
            retryOrFail(job.id, 'build-dom-timeout');
            return true;
          }
          return true;
        }

        if (job.payload?.kind === 'construct') {
          const u = new URL(location.href);
          const curCat = u.searchParams.get('category');
          const curGid = u.searchParams.get('gid');
          const wantCat = String(job.payload.constructCategory || job._catWant || '1');
          const wantGid = String(job.payload.gid);

          if (curGid && curGid === wantGid) {
            log('runner', `⚠ construct task but URL has gid=${curGid} → convert to upgrade`);
            patch(st => {
              if (st.currentJob?.id === job.id) {
                st.currentJob.payload.kind = 'upgrade';
                st.currentJob.target.params.gid = wantGid;
                delete st.currentJob.target.params.category;
                delete st.currentJob.payload.constructCategory;
                st.currentJob.state = 'BUILD_EXECUTING';
                st.currentJob.stateAt = now();
              }
            });
            return true;
          }

          if (String(curCat) !== wantCat) {
            log('runner', `↪ BUILD_EXECUTING: category mismatch (cur=${curCat || 'none'}, want=${wantCat}) → force URL`);
            saveCurrentJobAsTask(job.id, 'BUILD_EXECUTING', { _catWant: wantCat, readyAt: now() + 3000 });

            const newU = new URL(location.href);
            newU.searchParams.set('category', wantCat);
            log('runner', `↪ force URL → ${newU.pathname}${newU.search}`);
            location.href = newU.toString();
            return true;
          }
        }

        if (elapsed > CFG.LIMIT_BUILD_EXECUTING) { retryOrFail(job.id, 'exec-timeout'); return true; }
        if (typeof plugin.onArrive !== 'function') { retryOrFail(job.id, 'no-onArrive'); return true; }
        try {
          const mergedPayload = {
            ...job.payload,
            _skipVideo: job._skipVideo === true || job.payload?._skipVideo === true,
            _videoRetries: job._videoRetries ?? job.payload?._videoRetries ?? 0,
          };
          const action = await plugin.onArrive({ job, target: job.target, payload: mergedPayload, isVerify: false });
          handleAction(job.id, action || { type: 'done' });
        } catch (e) { retryOrFail(job.id, 'onArrive-threw: ' + e.message); }
        return true;
      }

      case 'BUILD_CONFIRMING': {
        if (isPopupOpen()) return false;

        if (!isHub()) {
          if (elapsed < 3000) return false;
          if (elapsed > CFG.BUILD_CONFIRMING_FORCE_NAV_MS) {
            log('runner', `⏱ still on ${pageType()} after ${elapsed}ms → force navigate to hub`);
            const hubPage = getTargetHub(job.target.params?.gid) || 'dorf2';
            const hubTarget = { page: hubPage, village: job.target.village };
            saveCurrentJobAsTask(job.id, 'BUILD_CONFIRMING', { readyAt: now() + 2000 });

            navigate(hubTarget).then(r => {
              if (!r.ok) retryOrFail(job.id, 'confirm-nav: '+r.reason);
            }).catch(e => retryOrFail(job.id, 'confirm-nav-ex: '+e.message));
            return true;
          }
          return false;
        }

        if (!isDomReadyForDorf()) {
          if (elapsed > CFG.DOM_READY_TIMEOUT_MS * 2) {
            log('runner', `⏱ dorf DOM timeout → verify`);
            setJobState(job.id, 'VERIFYING');
            return true;
          }
          return false;
        }
        if (elapsed < 1500) return false;

        if (job.plugin === 'Builder' && !plugins.get('Builder')) {
          if (elapsed > CFG.PLUGIN_GRACE_MS) {
            log('runner', `⏳ Builder plugin still not loaded → verify`);
            setJobState(job.id, 'VERIFYING');
            return true;
          }
          return false;
        }

        captureCurrentVillage();
        const v = readState().villages[String(job.target.village)];
        const bq = v?.buildQueue || [];
        const wantName = (job.payload.name || '').toLowerCase().trim();
        const wantLevel = job.payload.targetLevel || 0;
        const preIds = new Set(job.payload._preQueueIds || []);
        const found = bq.find(b => {
          const bName = (b.name || '').toLowerCase().trim();
          const nameMatch = bName === wantName || bName.includes(wantName) || wantName.includes(bName);
          const levelMatch = b.level === wantLevel;
          if (!nameMatch || !levelMatch) return false;
          if (preIds.size > 0 && b.buildingId && preIds.has(String(b.buildingId))) return false;
          return true;
        });

        if (found) {
          log('runner', `✓ confirmed via queue: ${found.name} L${found.level} (id=${found.buildingId || '?'})`);
          setJobState(job.id, 'BUILDING', {
            buildEndsAt: now() + (found.remaining || 0) * 1000 + 5000,
            confirmedItem: found,
            _confirmMethod: 'queue',
          });
          if (plugin?.onConfirmResult) {
            try { plugin.onConfirmResult({ job, status: 'confirmed', item: found, manualItems: [] }); }
            catch (e) { log('runner', `onConfirmResult threw: ${e.message}`); }
          }
          return true;
        }

        if (bq.length === 0) {
          log('runner', `⏸ queue empty → navigate to build.php to verify level`);
          saveCurrentJobAsTask(job.id, 'VERIFYING', { readyAt: now() + 1000 });
          const targetBuild = {
            page: 'build',
            village: job.target.village,
            params: {
              id: job.target.params?.id,
              gid: job.target.params?.gid,
              category: job.payload?.constructCategory,
            },
          };
          navigate(targetBuild).then(r => {
            if (!r.ok) retryOrFail(job.id, 'verify-nav: '+r.reason);
          }).catch(e => retryOrFail(job.id, 'verify-nav-ex: '+e.message));
          return true;
        }

        log('runner', `⏸ queue has other items but not ours: ${bq.map(b=>b.name+' L'+b.level).join(', ')}`);
        if (plugin?.onConfirmResult) {
          try { plugin.onConfirmResult({ job, status: 'manual', item: null, manualItems: bq }); }
          catch (e) { log('runner', `onConfirmResult threw: ${e.message}`); }
        }

        if (elapsed > 5000) {
          log('runner', `⏱ not in queue after 5s → verify level`);
          saveCurrentJobAsTask(job.id, 'VERIFYING', { readyAt: now() + 1000 });
          const targetBuild = {
            page: 'build',
            village: job.target.village,
            params: {
              id: job.target.params?.id,
              gid: job.target.params?.gid,
              category: job.payload?.constructCategory,
            },
          };
          navigate(targetBuild).then(r => {
            if (!r.ok) retryOrFail(job.id, 'verify-nav: '+r.reason);
          }).catch(e => retryOrFail(job.id, 'verify-nav-ex: '+e.message));
          return true;
        }
        return false;
      }

      case 'BUILD_CONFIRMING_VIDEO_WAIT': {
        if (isPopupOpen()) return false;

        if (isHub()) {
          log('runner', `✓ video: reloaded to hub → BUILD_CONFIRMING`);
          setJobState(job.id, 'BUILD_CONFIRMING');
          return true;
        }

        if (elapsed < CFG.VIDEO_WAIT_TIMEOUT_MS) return false;

        const retries = (job._videoRetries || 0) + 1;
        if (retries < CFG.VIDEO_MAX_RETRIES) {
          log('runner', `⏱ video timeout 90s (retry ${retries}/${CFG.VIDEO_MAX_RETRIES}) → reload & retry`);
          saveCurrentJobAsTask(job.id, 'BUILD_EXECUTING', {
            _videoRetries: retries,
            _skipVideo: false,
            readyAt: now() + 3000,
          });
          setTimeout(() => location.reload(), 500);
          return true;
        }

        log('runner', `✗ video failed ${retries}x → fallback to GREEN button`);
        saveCurrentJobAsTask(job.id, 'BUILD_EXECUTING', {
          _skipVideo: true,
          _videoRetries: 0,
          readyAt: now() + 2000,
        });
        return true;
      }

      case 'BUILDING': {
        captureCurrentVillage();
        // ═══ 0.0.4 FIX: BUILDING used to hold the queue until the build finished ═══
        // (buildEndsAt = build end + 5s, up to LIMIT_BUILDING = 4h). While a job
        // exists, pickNextJob() returns early and rotationTick() returns at
        // `if (s.currentJob) return;` — so a single 2h upgrade blocked rotation and
        // every other village's queued work, and the box showed
        // "next rotation → V0x in 0s" forever.
        // Now the job releases the queue after BUILDING_HOLD_MS (or sooner if the
        // build already ended) and verifies the item instead of waiting it out.
        const holdUntil = (job.stateAt || now()) + CFG.BUILDING_HOLD_MS;
        if (job.buildEndsAt && now() >= job.buildEndsAt && job.buildEndsAt <= holdUntil) {
          log('runner', `⏱ build ends → verify`);
          setJobState(job.id, 'VERIFYING');
          return true;
        }
        if (now() >= holdUntil) {
          log('runner', `✓ build queued — releasing queue after ${Math.round(CFG.BUILDING_HOLD_MS/1000)}s → verify`);
          setJobState(job.id, 'VERIFYING');
          return true;
        }
        return false;
      }

      case 'VERIFYING': {
        if (!isOnTarget(job.target, { relaxBuildParams: true })) {
          if (isHub()) {
            log('runner', `🎯 verify: navigate to build.php`);
            saveCurrentJobAsTask(job.id, 'VERIFYING', { readyAt: now() + 2000 });
            const targetBuild = {
              page: 'build',
              village: job.target.village,
              params: {
                id: job.target.params?.id,
                gid: job.target.params?.gid,
                category: job.payload?.constructCategory,
              },
            };
            navigate(targetBuild).then(r => {
              if (!r.ok) retryOrFail(job.id, 'verify-nav: '+r.reason);
            }).catch(e => retryOrFail(job.id, 'verify-nav-ex: '+e.message));
            return true;
          }
          if (!isHub()) {
            if (elapsed > CFG.LIMIT_VERIFYING) { retryOrFail(job.id, 'verify-nav-timeout'); return true; }
            return true;
          }
          return true;
        }

        if (!isDomReadyForBuildPage()) {
          if (elapsed > CFG.DOM_READY_TIMEOUT_MS) { retryOrFail(job.id, 'verify-dom-timeout'); return true; }
          return true;
        }
        if (elapsed > CFG.LIMIT_VERIFYING) { retryOrFail(job.id, 'verify-timeout'); return true; }
        if (typeof plugin.onArrive !== 'function') { retryOrFail(job.id, 'no-onArrive'); return true; }
        try {
          const action = await plugin.onArrive({ job, target: job.target, payload: job.payload, isVerify: true });
          handleAction(job.id, action || { type: 'done' });
        } catch (e) { retryOrFail(job.id, 'verify-threw: ' + e.message); }
        return true;
      }
    }
    return false;
  }

  function handleAction(jobId, action) {
    switch (action.type) {
      case 'done': return finishJob(jobId, action.reason || 'done');
      case 'wait': return pauseSimple(jobId, action.delayMs || 30000, action.reason);
      case 'retry': return retryOrFail(jobId, action.reason || 'retry');
      case 'fail': return retryOrFail(jobId, action.reason || 'fail');
      case 'transition': {
        const s = readState();
        if (s.currentJob?.id === jobId) setJobState(jobId, action.state, action.extra || {});
        return;
      }
      default: log('runner', `⚠ unknown action: ${action.type}`); return finishJob(jobId, 'unknown');
    }
  }
  function pauseSimple(jobId, delayMs, reason) {
    const s = readState();
    const job = s.currentJob;
    if (!job || job.id !== jobId) return;
    patch(st => {
      if (st.currentJob?.id !== jobId) return;
      st.currentJob = null;
      const moved = { ...job };
      moved.readyAt = now() + delayMs;
      moved.lastError = reason || 'wait';
      moved.createdAt = moved.createdAt || now();
      delete moved.state; delete moved.stateAt; delete moved.startedAt;
      delete moved.snapshotBefore; delete moved._graceLogged; delete moved._domWaitLogged;
      delete moved._hubBounceCount; delete moved._waitLogged;
      st.tasks.push(moved);
    });
  }

  async function pickNextJob() {
    const s = readState();
    if (s.currentJob) return;
    if (!s.heartbeat.enabled) return;
    if (s.workerLock && s.workerLock.tabId !== MY_TAB && s.workerLock.expiresAt > now()) return;
    patch(st => { st.workerLock = { tabId: MY_TAB, expiresAt: now() + CFG.WORKER_LOCK_TTL_MS }; });
    if (s.heartbeat.masterPaused) return;
    const ready = canAct();
    if (!ready.ok) return;
    const task = pickRunnableTask();
    if (task) {
      patch(st => {
        st.tasks = st.tasks.filter(t => t.id !== task.id);
        const isHeartbeat = task.plugin === 'Heartbeat';
        const restoredState = (task.state && task.stateAt && (now() - task.stateAt < CFG.RESTORED_STATE_MAX_AGE_MS))
          ? task.state
          : null;
        const finalState = restoredState || (isHeartbeat ? 'NAVIGATING' : 'HUB_NAVIGATING');

        st.currentJob = {
          ...task,
          state: finalState,
          stateAt: now(),
          startedAt: now(),
          attempts: task.attempts || 0,
          _hubBounceCount: 0,
          _sessionReset: true,
        };
      });
      if (task.state && task.stateAt && (now() - task.stateAt < CFG.RESTORED_STATE_MAX_AGE_MS)) {
        log('runner', `↩ resume with saved state: ${task.state} — reset stateAt`);
      }
      log('runner', `▶ start: ${task.plugin} → ${task.target.page}@${vLabel(task.target.village)}`);
      if (task.plugin === 'Heartbeat') {
        navigate(task.target).then(r => {
          if (!r.ok) retryOrFail(task.id, 'nav: '+r.reason);
        }).catch(e => retryOrFail(task.id, e.message));
      } else {
        const restoredState = (task.state && task.stateAt && (now() - task.stateAt < CFG.RESTORED_STATE_MAX_AGE_MS))
          ? task.state
          : null;

        if (restoredState === 'BUILD_EXECUTING' || restoredState === 'VERIFYING') {
          const u = new URL(location.href);
          const curPage = pageType();
          const curId = u.searchParams.get('id');
          const curCat = u.searchParams.get('category');
          const wantId = String(task.target.params?.id || '');
          const wantCat = String(task.payload?.constructCategory || task._catWant || '');

          if (curPage === 'build' && curId === wantId && (wantCat === '' || curCat === wantCat)) {
            log('runner', `✓ already at build.php?id=${curId}&category=${curCat || 'none'} → skip navigation`);
            return;
          }
        }

        if (restoredState === 'BUILD_CONFIRMING' || restoredState === 'BUILD_CONFIRMING_VIDEO_WAIT') {
          if (isHub()) {
            log('runner', `✓ already at hub → skip navigation`);
            return;
          }
        }

        const targetGid = task.target.params?.gid;
        const hubPage = getTargetHub(targetGid);
        const hubTarget = { page: hubPage, village: task.target.village };
        if (isOnTarget(hubTarget)) {
          setJobState(task.id, 'HUB_VISITING');
        } else {
          const curVid = curVillageId();
          if (curVid && String(curVid) !== String(task.target.village)) {
            recordRotationContext(curVid);
            ssSet(SS_PAGE_MARK, 'nova');
          }
          navigate(hubTarget).then(r => {
            if (!r.ok) retryOrFail(task.id, 'hub-nav: '+r.reason);
          }).catch(e => retryOrFail(task.id, 'hub-nav-ex: '+e.message));
        }
      }
      return;
    }
    rotationTick();
  }

  async function advanceJobLegacy() {
    const s = readState();
    const job = s.currentJob;
    if (!job) return false;
    if (!s.heartbeat.enabled) { patch(st => { st.currentJob = null; }); return true; }
    const elapsed = now() - (job.stateAt || job.startedAt || now());
    const plugin = plugins.get(job.plugin);
    if (!plugin) { retryOrFail(job.id, 'no-plugin'); return true; }
    switch (job.state) {
      case 'NAVIGATING':
        if (isOnTarget(job.target)) { setJobState(job.id, 'EXECUTING'); return true; }
        if (elapsed > CFG.LIMIT_BUILD_NAVIGATING) retryOrFail(job.id, 'nav-timeout');
        return true;
      case 'EXECUTING':
        if (elapsed > CFG.LIMIT_BUILD_EXECUTING) { retryOrFail(job.id, 'exec-timeout'); return true; }
        try {
          const action = await plugin.onArrive({ job, target: job.target, payload: job.payload });
          handleAction(job.id, action || { type: 'done' });
        } catch (e) { retryOrFail(job.id, 'onArrive-threw: ' + e.message); }
        return true;
    }
    return false;
  }

  // ═════ 2.0.2.21: watchdog — expire rotation → reschedule ═════
  function watchdog() {
    const s = readState();
    const n = now();
    const expiring = s.tasks.filter(t => t.expiresAt <= n);
    for (const t of expiring) {
      // ═══ FIX: if a rotation task expired, reschedule it ═══
      if (t.payload?.rotation) {
        log('watchdog', `⏱ rotation task expired → reschedule in ${CFG.ROTATION_EXPIRE_RESCHEDULE_MS/1000}s`);
        patch(st => { st.heartbeat.nextRotationAt = n + CFG.ROTATION_EXPIRE_RESCHEDULE_MS; });
      }
      const plugin = plugins.get(t.plugin);
      if (plugin?.onFail) {
        try { plugin.onFail({ job: t, reason: 'ttl-expired' }); } catch (e) { log('watchdog', `onFail threw: ${e.message}`); }
      }
      log('watchdog', `expired task: ${t.plugin}@${vLabel(t.villageId)}`);
    }
    patch(st => {
      const before = st.tasks.length;
      st.tasks = st.tasks.filter(t => t.expiresAt > n);
      if (st.tasks.length !== before) log('watchdog', `cleaned ${before - st.tasks.length} task(s)`);
    });

    if (s.currentJob) {
      const stateAge = n - (s.currentJob.stateAt || n);
      if (stateAge < CFG.WATCHDOG_GRACE_MS) return;
      const state = s.currentJob.state;
      const limits = {
        'HUB_NAVIGATING': CFG.LIMIT_HUB_NAVIGATING,
        'HUB_VISITING': CFG.LIMIT_HUB_VISITING,
        'HUB_DECIDING': CFG.LIMIT_HUB_DECIDING,
        'BUILD_NAVIGATING': CFG.LIMIT_BUILD_NAVIGATING,
        'BUILD_EXECUTING': CFG.LIMIT_BUILD_EXECUTING,
        'BUILD_CONFIRMING': CFG.LIMIT_BUILD_CONFIRMING,
        'BUILD_CONFIRMING_VIDEO_WAIT': CFG.LIMIT_BUILD_CONFIRMING_VIDEO_WAIT,
        'BUILDING': CFG.LIMIT_BUILDING,
        'VERIFYING': CFG.LIMIT_VERIFYING,
      };
      const limit = limits[state] || (CFG.LIMIT_HUB_NAVIGATING * 3);
      if (stateAge > limit) {
        log('watchdog', `job stuck ${Math.round(stateAge/1000)}s in ${state} → retry`);
        retryOrFail(s.currentJob.id, 'watchdog-stuck-' + state);
      }
    }
  }

