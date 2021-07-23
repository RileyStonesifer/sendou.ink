import { Box, Flex } from "@chakra-ui/layout";
import MyLink from "components/common/MyLink";
import UserAvatar from "components/common/UserAvatar";
import { useUser } from "hooks/common";
import { CSSVariables } from "utils/CSSVariables";

export const UserItem = ({ expanded }: { expanded: boolean }) => {
  const [user] = useUser();

  if (!user) return null;

  return (
    <Box borderLeft="4px solid" borderColor={CSSVariables.bgColor} pl={2}>
      <MyLink href={"/u/" + user.discordId} isColored={false} noUnderline>
        <Flex
          width="100%"
          rounded="lg"
          p={2}
          fontSize="sm"
          fontWeight="bold"
          align="center"
          whiteSpace="nowrap"
          _hover={{
            bg: CSSVariables.secondaryBgColor,
          }}
        >
          <>
            <UserAvatar user={user} size="sm" />
            {expanded && <Box ml={2}>My Page</Box>}
          </>
        </Flex>
      </MyLink>
    </Box>
  );
};

export default UserItem;
