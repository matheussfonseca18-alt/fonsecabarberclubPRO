import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalogQuery } from "../src/data/catalog-query.ts";
import type { CatalogReadResult, CatalogKind } from "../src/data/catalog-read.ts";
import { catalogReadActivation, catalogReader, catalogSessionSource } from "../src/data/catalog-access.ts";

test("application wiring is inactive and cannot deliver records", async()=>{
  assert.deepEqual(catalogReadActivation,{enabled:false});
  assert.equal(Object.isFrozen(catalogReadActivation),true);
  assert.equal(await catalogSessionSource.getSession(),null);
  for(const kind of ["professionals","services","products"] as const){
    const result=await catalogReader.list(kind);
    assert.equal(result.state,"inactive");
    assert.equal(Object.hasOwn(result,"rows"),false);
  }
});

test("catalog mismatch is rejected before notifying the view",async()=>{
  const query=createCatalogQuery({list:async()=>({state:"ready",kind:"products",rows:[],total:0})},()=>{});
  await query.load("professionals");
  assert.equal(query.snapshot()?.result.state,"error");
});

test("catalog navigation cancels old reads and ignores late rows",async()=>{
  const requests: Array<{signal?:AbortSignal;finish:(result:CatalogReadResult<CatalogKind>)=>void}> = [];
  const query = createCatalogQuery({list:(_kind,options)=>new Promise(resolve=>requests.push({signal:options?.signal,finish:resolve}))},()=>{});
  const first = query.load("professionals");
  const second = query.load("products");
  assert.equal(requests[0].signal?.aborted,true);
  requests[1].finish({state:"ready",kind:"products",rows:[],total:0});
  await second;
  requests[0].finish({state:"ready",kind:"professionals",rows:[],total:0});
  await first;
  assert.equal(query.snapshot()?.kind,"products");
});

test("auth invalidation removes rendered data and cannot be undone by a late result",async()=>{
  let finish!:(value:CatalogReadResult<CatalogKind>)=>void;
  const query=createCatalogQuery({list:()=>new Promise(resolve=>{finish=resolve;})},()=>{});
  const pending=query.load("services");
  query.clear();
  assert.equal(query.snapshot(),null);
  finish({state:"ready",kind:"services",rows:[],total:0});
  await pending;
  assert.equal(query.snapshot(),null);
  query.dispose();
  await query.load("products");
  assert.equal(query.snapshot(),null);
});
