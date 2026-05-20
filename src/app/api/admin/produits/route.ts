import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildTarificationData, buildInventoryData } from "@/lib/product-helpers";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const produits = await prisma.produit.findMany({
    include: {
      tarification: true,
      inventories: {
        include: {
          store: true,
        },
        orderBy: {
          store: {
            name: "asc",
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { slug: "asc" }],
  });

  return NextResponse.json(produits);
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const data = body ?? {};
    const inventories = Array.isArray(data.inventories) ? data.inventories : [];
    const stockTotal = inventories.reduce((sum: number, item: any) => sum + Number(item?.totalQuantity ?? 0), 0);
    const stockDisponible = inventories.reduce((sum: number, item: any) => sum + Number(item?.availableQuantity ?? 0), 0);
    const created = await prisma.produit.create({
      data: {
        ...data,
        stockTotal,
        stockDisponible,
        tarification: data.tarification
          ? { create: buildTarificationData(data.tarification) }
          : undefined,
        inventories: inventories.length
          ? { create: inventories.map((inv: any) => buildInventoryData(inv, admin.id)) }
          : undefined,
      },
    } as any);
    revalidatePath('/');
    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, data } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { tarification, inventories, ...scalarData } = data ?? {};
    const updateData: any = { ...scalarData, updatedById: admin.id };

    if (Array.isArray(inventories)) {
      updateData.stockTotal = inventories.reduce((sum: number, item: any) => sum + Number(item?.totalQuantity ?? 0), 0);
      updateData.stockDisponible = inventories.reduce((sum: number, item: any) => sum + Number(item?.availableQuantity ?? 0), 0);
      updateData.inventories = {
        upsert: inventories.map((inv: any) => ({
          where: { produitId_storeId: { produitId: id, storeId: inv.storeId } },
          create: buildInventoryData(inv, admin.id),
          update: buildInventoryData(inv, admin.id),
        })),
      };
    }

    if (tarification) {
      const tarifData = buildTarificationData(tarification);
      updateData.tarification = {
        upsert: { create: tarifData, update: tarifData },
      };
    }

    const updated = await prisma.produit.update({ where: { id }, data: updateData });
    revalidatePath('/');
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await prisma.produit.delete({ where: { id } });
    revalidatePath('/');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
