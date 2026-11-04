"""Real database/browser regression; requires a locally minted admin session.

Run: python3 tests/implementation_delete_regression.py
Only creates and deletes its own isolated fixture, never existing projects.
"""
import asyncio
import hashlib
import json
import uuid
from pathlib import Path

from playwright.async_api import async_playwright


async def main():
    with open(Path.home() / '.cache/lovable-auth/session.json') as f:
        auth = json.load(f)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        await page.goto('http://localhost:8080', wait_until='domcontentloaded')
        await page.wait_for_timeout(1500)
        await page.evaluate('([k,v])=>localStorage.setItem(k,v)', [auth['storage_key'], json.dumps(auth['session'])])
        await page.evaluate('''async session => {
            const {getSupabaseBrowserClient} = await import('/src/lib/api/supabase-client.ts');
            const {error} = await getSupabaseBrowserClient().auth.setSession(session);
            if(error) throw Error(error.message);
        }''', {"access_token": auth['session']['access_token'], "refresh_token": auth['session']['refresh_token']})
        async def db(action, data):
            return await page.evaluate('''async ({action,data}) => {
                const {getSupabaseBrowserClient,getSupabasePublicBrowserClient} = await import('/src/lib/api/supabase-client.ts');
                const c = getSupabaseBrowserClient();
                let r;
                if(action==='create') r=await c.from('implementation_projects').insert(data).select('id,code').single();
                if(action==='link') r=await c.rpc('admin_create_field_link',data);
                if(action==='patch') r=await c.from('implementation_projects').update(data.patch).eq('id',data.id);
                if(action==='delete') r=await c.rpc('admin_delete_implementation',data);
                if(action==='anon') r=await getSupabasePublicBrowserClient().rpc('admin_delete_implementation',data);
                if(action==='counts') {
                    const p=await c.from('implementation_projects').select('id').eq('id',data.id);
                    const l=await c.from('implementation_field_links').select('id').eq('implementation_id',data.id);
                    if(p.error||l.error) throw Error(p.error?.message||l.error?.message);
                    return {projects:p.data.length,links:l.data.length};
                }
                return {data:r.data,error:r.error?.message};
            }''', {"action": action, "data": data})
        uid = str(uuid.uuid4())
        code = 'QA-DELETE-' + uid
        created = await db('create', {"id": uid, "code": code, "nickname": "QA exclusão descartável"})
        assert not created.get('error'), created.get('error')
        args = {"_id": uid, "_confirm_code": code}
        try:
            linked = await db('link', {"p_implementation_id": uid, "p_hash": hashlib.sha256(uid.encode()).hexdigest()})
            assert not linked.get('error'), linked.get('error')
            denied = await db('anon', args)
            assert denied.get('error'), 'Anonymous deletion must be denied'
            denied = await db('delete', {**args, "_confirm_code": "WRONG"})
            assert 'Código de confirmação' in (denied.get('error') or '')
            assert await db('counts', {"id": uid}) == {"projects": 1, "links": 1}
            for patch in [{"status": "ativo"}, {"status": "prospect", "core_property_id": str(uuid.uuid4())}, {"core_property_id": None, "core_owner_id": str(uuid.uuid4())}]:
                changed = await db('patch', {"id": uid, "patch": patch})
                assert not changed.get('error'), changed.get('error')
                denied = await db('delete', args)
                assert 'ativa ou vinculada ao Core' in (denied.get('error') or '')
                assert await db('counts', {"id": uid}) == {"projects": 1, "links": 1}
            changed = await db('patch', {"id": uid, "patch": {"status": "prospect", "core_property_id": None, "core_owner_id": None}})
            assert not changed.get('error'), changed.get('error')
            deleted = await db('delete', args)
            assert not deleted.get('error'), deleted.get('error')
            assert await db('counts', {"id": uid}) == {"projects": 0, "links": 0}
            print('PASS: linked deletion, wrong code, anonymous denial, active, Core property and Core owner guards')
        finally:
            await db('patch', {"id": uid, "patch": {"status": "prospect", "core_property_id": None, "core_owner_id": None}})
            await db('delete', args)
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())