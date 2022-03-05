import {
  ActionFunction,
  Form,
  json,
  LinksFunction,
  LoaderFunction,
  MetaFunction,
  redirect,
  useLoaderData,
  useLocation,
  useTransition,
} from "remix";
import { z } from "zod";
import { LFGGroupSelector } from "~/components/play/LFGGroupSelector";
import styles from "~/styles/play.css";
import {
  getLogInUrl,
  getUser,
  makeTitle,
  parseRequestFormData,
  requireUser,
  validate,
} from "~/utils";
import * as LFGGroup from "~/models/LFGGroup.server";
import * as Skill from "~/models/Skill.server";
import { Button } from "~/components/Button";
import { useUser } from "~/hooks/common";
import { countGroups, resolveRedirect } from "~/core/play/utils";
import { resolveOwnMMR } from "~/core/mmr/utils";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};

// TODO: Switch to layout component
export const meta: MetaFunction = () => {
  return {
    title: makeTitle("Play!"),
  };
};

const playActionSchema = z.object({
  _action: z.literal("CREATE_LFG_GROUP"),
  type: z.enum(["VERSUS-RANKED", "VERSUS-UNRANKED", "TWIN", "QUAD"]),
});

export const action: ActionFunction = async ({ request, context }) => {
  const data = await parseRequestFormData({
    request,
    schema: playActionSchema,
  });
  const user = requireUser(context);

  const ids = await LFGGroup.activeUserIds();
  validate(!ids.has(user.id), "Already in an active group");

  switch (data._action) {
    case "CREATE_LFG_GROUP": {
      const getRanked = () => {
        if (!data.type.startsWith("VERSUS")) return;
        return data.type.includes("UNRANKED") ? false : true;
      };
      const getType = () => {
        switch (data.type) {
          case "VERSUS-RANKED":
          case "VERSUS-UNRANKED":
            return "VERSUS";
          case "QUAD":
          case "TWIN":
            return data.type;
        }
      };
      const group = await LFGGroup.create({
        user,
        type: getType(),
        ranked: getRanked(),
      });

      if (group.status === "LOOKING") {
        return redirect("/play/looking");
      }

      return redirect("/play/add-players");
    }
    default: {
      const exhaustive: never = data._action;
      throw new Response(`Unknown action: ${JSON.stringify(exhaustive)}`, {
        status: 400,
      });
    }
  }
};

export interface PlayFrontPageLoader {
  counts: Record<"TWIN" | "QUAD" | "VERSUS-RANKED" | "VERSUS-UNRANKED", number>;
  ownMMR?: {
    value: number;
    topX?: number;
  };
}

export const loader: LoaderFunction = async ({ context }) => {
  const user = getUser(context);

  const [{ groups, ownGroup }, skills] = await Promise.all([
    LFGGroup.findLookingAndOwnActive(user?.id, true),
    Skill.findAllMostRecent(),
  ]);

  const ownMMR = resolveOwnMMR({ skills, user });

  if (!user)
    return json<PlayFrontPageLoader>({ counts: countGroups(groups), ownMMR });

  if (!ownGroup) {
    return json<PlayFrontPageLoader>({ counts: countGroups(groups), ownMMR });
  }
  const redirectRes = resolveRedirect({
    currentStatus: ownGroup.status,
    currentPage: "INACTIVE",
    matchId: ownGroup.matchId,
  });
  if (redirectRes) return redirectRes;

  throw new Error(`Unexpected state - group status: ${ownGroup.status}`);
};

export default function PlayPage() {
  const transition = useTransition();
  const user = useUser();
  const location = useLocation();
  const data = useLoaderData<PlayFrontPageLoader>();

  return (
    <div>
      {data.ownMMR && (
        <div className="play__own-mmr">
          <div className="play__own-mmr__mmr">SP: {data.ownMMR.value}</div>
          {data.ownMMR.topX && (
            <div className="play__own-mmr__topx">
              Top {data.ownMMR.topX}% (better than {100 - data.ownMMR.topX}% of
              players)
            </div>
          )}
        </div>
      )}
      <Form method="post">
        <input type="hidden" name="_action" value="CREATE_LFG_GROUP" />
        <LFGGroupSelector counts={data.counts} />
        {user ? (
          <Button
            className="play__continue-button"
            type="submit"
            loading={transition.state === "submitting"}
            loadingText="Continuing..."
          >
            Continue
          </Button>
        ) : (
          <form action={getLogInUrl(location)} method="post">
            <p className="button-text-paragraph play__log-in">
              To start looking first{" "}
              <Button type="submit" variant="minimal">
                log in
              </Button>
            </p>
          </form>
        )}
      </Form>
    </div>
  );
}
